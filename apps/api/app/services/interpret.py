from __future__ import annotations

from collections import defaultdict
from collections import deque
from math import inf
from typing import Any

from app.schemas.common import WarningItem
from app.schemas.request import DiagramSemanticRequest, EdgeInput, NodeInput
from app.services.reader_text import normalize_inline_text

FLOW_NODE_TYPES = {"start", "activity", "decision", "end", "sync-bar"}
MAIN_SPINE_NODE_TYPES = {"activity", "decision", "end"}
BUSINESS_HANDOFF_SOURCE_TYPES = {"activity"}
BUSINESS_HANDOFF_TARGET_TYPES = {"activity", "decision"}
CONTEXT_NOTE_MAX_Y = 220.0


def interpret_request(
    payload: DiagramSemanticRequest,
    warnings: list[WarningItem],
) -> dict[str, Any]:
    node_map = {node.id: node for node in payload.nodes}
    lane_map = {lane.id: lane for lane in payload.lanes}
    outgoing: dict[str, list[EdgeInput]] = defaultdict(list)
    incoming: dict[str, list[EdgeInput]] = defaultdict(list)
    for edge in payload.edges:
        outgoing[edge.source_node_id].append(edge)
        incoming[edge.target_node_id].append(edge)
    for edges in outgoing.values():
        edges.sort(key=lambda edge: sort_node_key(node_map.get(edge.target_node_id)))
    for edges in incoming.values():
        edges.sort(key=lambda edge: sort_node_key(node_map.get(edge.source_node_id)))

    start_nodes = sorted(
        [node for node in payload.nodes if node.type == "start"],
        key=sort_node_key,
    )
    reachable_ids: set[str] = set()
    active_path: set[str] = set()

    def traverse_reachable(node_id: str) -> None:
        if node_id in reachable_ids or node_id in active_path:
            return
        node = node_map.get(node_id)
        if not node or node.type not in FLOW_NODE_TYPES:
            return
        active_path.add(node_id)
        reachable_ids.add(node_id)
        for edge in outgoing.get(node_id, []):
            traverse_reachable(edge.target_node_id)
        active_path.remove(node_id)

    for start_node in start_nodes:
        traverse_reachable(start_node.id)

    preferred_path_ids = build_preferred_path(start_nodes, outgoing, node_map)
    preferred_path_set = set(preferred_path_ids)
    main_flow_nodes = [
        node_map[node_id]
        for node_id in preferred_path_ids
        if node_id in node_map and node_map[node_id].type in MAIN_SPINE_NODE_TYPES
    ]
    branches = build_branch_items(payload.nodes, node_map, lane_map, outgoing, preferred_path_set)
    handoffs = build_business_handoffs(payload.edges, node_map, lane_map)
    parallel_blocks = analyze_sync_bars(payload.nodes, outgoing, incoming, node_map, lane_map)

    notes = [node for node in payload.nodes if node.type == "note" and node.text]
    anchored_notes = []
    context_notes = []
    global_notes = []
    for note in notes:
        note_kind, anchor_node = classify_note_semantics(note, payload.nodes, outgoing, node_map)
        if note_kind == "step_annotation" and anchor_node:
            anchored_notes.append((note, anchor_node))
        elif note_kind == "context_note":
            context_notes.append(note)
        else:
            global_notes.append(note)

    loop_warning = next((item for item in warnings if item.code == "GRAPH_HAS_LOOP"), None)
    loops = []
    if loop_warning:
        loops.append(
            {
                "node_ids": loop_warning.related_node_ids,
                "note": "Phát hiện retry/escalation loop trong diagram.",
            }
        )

    disconnected_flow_nodes = [
        node
        for node in sorted(payload.nodes, key=sort_node_key)
        if node.type in FLOW_NODE_TYPES and node.type != "start" and node.id not in reachable_ids
    ]

    open_questions = [
        f'Quyết định tại bước "{branch["decision_text"]}" chưa rõ tiêu chí nhánh; cần xác nhận.'
        for branch in branches
        if any(outcome["status"] == "unlabeled" for outcome in branch["outcomes"])
    ]
    if len(start_nodes) > 1:
        open_questions.append(
            "Diagram co nhieu hon 1 start node; can xac nhan start chinh de sinh BRD nhat quan."
        )
    if disconnected_flow_nodes:
        open_questions.append(
            "Co node flow khong reachable tu start: "
            + ", ".join(f'"{human_node_label(node, lane_map)}"' for node in disconnected_flow_nodes)
            + ". Can xac nhan co nen dua vao quy trinh chinh hay khong."
        )

    assumptions = [
        f'Note "{note.text}" không xác định được vị trí trong flow.'
        for note in global_notes
        if note.text
    ]
    annotations = [
        format_anchored_note_annotation(note, anchor_node, lane_map)
        for note, anchor_node in anchored_notes
        if note.text
    ]
    context_note_items = [
        format_context_note(note)
        for note in context_notes
        if note.text
    ]

    return {
        "node_map": node_map,
        "lane_map": lane_map,
        "main_flow_nodes": main_flow_nodes,
        "branches": branches,
        "handoffs": handoffs,
        "parallel_blocks": parallel_blocks,
        "loops": loops,
        "annotations": annotations,
        "context_notes": context_note_items,
        "assumptions": assumptions,
        "open_questions": open_questions,
        "traceable_node_ids": sorted(node.id for node in payload.nodes if node.type != "note"),
    }


def sort_node_key(node: NodeInput | None) -> tuple[float, float, str]:
    if not node:
        return (float("inf"), float("inf"), "")
    return (node.y, node.x, node.id)


def build_preferred_path(
    start_nodes: list[NodeInput],
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
) -> list[str]:
    if not start_nodes:
        return []

    preferred_path_ids: list[str] = []
    seen_in_path: set[str] = set()
    current_node = start_nodes[0]

    while current_node.id not in seen_in_path:
        seen_in_path.add(current_node.id)
        if current_node.type in MAIN_SPINE_NODE_TYPES:
            preferred_path_ids.append(current_node.id)
        if current_node.type == "end":
            break
        next_edges = outgoing.get(current_node.id, [])
        if not next_edges:
            break
        next_edge = sorted(
            next_edges,
            key=lambda edge: preferred_edge_key(current_node, edge, node_map),
        )[0]
        next_node = node_map.get(next_edge.target_node_id)
        if not next_node:
            break
        current_node = next_node

    return preferred_path_ids


def preferred_edge_key(
    node: NodeInput,
    edge: EdgeInput,
    node_map: dict[str, NodeInput],
) -> tuple[int, tuple[float, float, str]]:
    target_node = node_map.get(edge.target_node_id)
    target_key = sort_node_key(target_node)
    if node.type != "decision":
        return (0, target_key)
    label = (edge.label or "").strip().lower()
    truthy_priority = {"co", "có", "yes", "y", "true", "ok", "đúng", "dung"}
    falsy_priority = {"khong", "không", "no", "n", "false", "sai"}
    if label in truthy_priority:
        return (0, target_key)
    if label in falsy_priority:
        return (2, target_key)
    return (1, target_key)


def build_branch_items(
    nodes: list[NodeInput],
    node_map: dict[str, NodeInput],
    lane_map: dict[str, Any],
    outgoing: dict[str, list[EdgeInput]],
    preferred_path_set: set[str],
) -> list[dict[str, Any]]:
    branches: list[dict[str, Any]] = []

    for node in sorted(nodes, key=sort_node_key):
        if node.type != "decision":
            continue
        decision_actor_name = lane_title(node.lane_id, lane_map)
        outcomes = []
        for edge in outgoing.get(node.id, []):
            target = node_map.get(edge.target_node_id)
            path_nodes, rejoin_node_id = trace_branch_path(
                edge.target_node_id,
                node_map,
                outgoing,
                preferred_path_set,
            )
            outcomes.append(
                {
                    "label": edge.label or None,
                    "target_node_id": edge.target_node_id,
                    "target_node_text": human_node_label(target, lane_map, include_actor=True)
                    if target
                    else None,
                    "status": "labeled" if edge.label else "unlabeled",
                    "path_summary": [
                        human_node_label(path_node, lane_map, include_actor=True)
                        for path_node in path_nodes
                    ],
                    "rejoin_node_id": rejoin_node_id,
                    "rejoin_node_text": human_node_label(
                        node_map.get(rejoin_node_id),
                        lane_map,
                        include_actor=True,
                    )
                    if rejoin_node_id and rejoin_node_id in node_map
                    else None,
                    "continues_main_flow": edge.target_node_id in preferred_path_set,
                }
            )
        branches.append(
            {
                "decision_node_id": node.id,
                "decision_text": normalize_inline_text(node.text) or "Decision",
                "decision_actor_name": decision_actor_name,
                "outcomes": outcomes,
            }
        )

    return branches


def trace_branch_path(
    start_node_id: str,
    node_map: dict[str, NodeInput],
    outgoing: dict[str, list[EdgeInput]],
    preferred_path_set: set[str],
    max_steps: int = 8,
) -> tuple[list[NodeInput], str | None]:
    path_nodes: list[NodeInput] = []
    current_id = start_node_id
    visited: set[str] = set()

    while current_id and current_id not in visited and len(path_nodes) < max_steps:
        if current_id in preferred_path_set and current_id != start_node_id:
            return path_nodes, current_id
        current_node = node_map.get(current_id)
        if not current_node:
            break
        visited.add(current_id)
        if current_node.type != "sync-bar":
            path_nodes.append(current_node)
        if current_node.type in {"end", "decision"} and current_id != start_node_id:
            break
        next_edges = outgoing.get(current_id, [])
        if current_node.type == "sync-bar" or len(next_edges) != 1:
            break
        next_id = next_edges[0].target_node_id
        if next_id in preferred_path_set and next_id != start_node_id:
            return path_nodes, next_id
        current_id = next_id

    return path_nodes, None


def build_business_handoffs(
    edges: list[EdgeInput],
    node_map: dict[str, NodeInput],
    lane_map: dict[str, Any],
) -> list[dict[str, Any]]:
    handoffs: list[dict[str, Any]] = []

    for edge in edges:
        source = node_map.get(edge.source_node_id)
        target = node_map.get(edge.target_node_id)
        if not source or not target:
            continue
        if source.type not in BUSINESS_HANDOFF_SOURCE_TYPES:
            continue
        if target.type not in BUSINESS_HANDOFF_TARGET_TYPES:
            continue
        if not source.lane_id or not target.lane_id or source.lane_id == target.lane_id:
            continue
        if not source.text or not target.text:
            continue
        handoffs.append(
            {
                "from_actor": lane_title(source.lane_id, lane_map) or "Actor chưa xác định",
                "to_actor": lane_title(target.lane_id, lane_map) or "Actor chưa xác định",
                "source_node_id": source.id,
                "target_node_id": target.id,
                "source_step_text": source.text,
                "target_step_text": target.text,
                "reason": describe_business_handoff(source, target),
            }
        )

    return handoffs


def describe_business_handoff(source: NodeInput, target: NodeInput) -> str:
    source_text = normalize_inline_text(source.text)
    target_text = normalize_inline_text(target.text)
    if target.type == "decision":
        return f'Chuyển thông tin để bên tiếp theo ra quyết định tại bước "{target_text}".'
    return f'Bàn giao xử lý từ bước "{source_text}" sang bước "{target_text}".'


def resolve_note_anchor(
    note: NodeInput,
    nodes: list[NodeInput],
    max_distance: float = 220.0,
) -> NodeInput | None:
    metadata = note.metadata or {}
    explicit_anchor_id = metadata.get("anchor_node_id") or metadata.get("anchorNodeId")
    if isinstance(explicit_anchor_id, str):
        explicit_anchor = next(
            (
                candidate
                for candidate in nodes
                if candidate.id == explicit_anchor_id and candidate.type != "note"
            ),
            None,
        )
        if explicit_anchor:
            return explicit_anchor

    candidates = [
        candidate
        for candidate in nodes
        if candidate.id != note.id
        and candidate.type != "note"
        and candidate.lane_id == note.lane_id
    ]
    if not candidates:
        return None

    nearest = min(candidates, key=lambda candidate: note_distance(note, candidate))
    if note_distance(note, nearest) <= max_distance:
        return nearest
    return None


def classify_note_semantics(
    note: NodeInput,
    nodes: list[NodeInput],
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
) -> tuple[str, NodeInput | None]:
    anchor_node = resolve_note_anchor(note, nodes)
    if is_context_note(note, anchor_node, nodes, outgoing, node_map):
        return ("context_note", None)
    if anchor_node:
        return ("step_annotation", anchor_node)
    return ("global_note", None)


def is_context_note(
    note: NodeInput,
    anchor_node: NodeInput | None,
    nodes: list[NodeInput],
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
) -> bool:
    text = (note.text or "").strip()
    if not text:
        return False
    if anchor_node and anchor_node.type == "start":
        return True
    has_list_shape = ("\n-" in text) or (text.count("\n") >= 2 and ":" in text)
    if not has_list_shape:
        return False
    if note.y <= CONTEXT_NOTE_MAX_Y:
        return True
    start_nodes = [node for node in nodes if node.type == "start"]
    if not start_nodes:
        return False
    nearest_start = min(start_nodes, key=lambda start: note_distance(note, start))
    if note_distance(note, nearest_start) > 220:
        return False
    reachable_after_start = {
        edge.target_node_id
        for edge in outgoing.get(nearest_start.id, [])
        if edge.target_node_id in node_map
    }
    return anchor_node is None or anchor_node.id not in reachable_after_start


def note_distance(note: NodeInput, candidate: NodeInput) -> float:
    return abs(note.x - candidate.x) + abs(note.y - candidate.y)


def format_anchored_note_annotation(
    note: NodeInput,
    anchor_node: NodeInput,
    lane_map: dict[str, Any],
) -> str:
    anchor_label = human_node_label(anchor_node, lane_map)
    return f'Note cho bước "{anchor_label}": {normalize_inline_text(note.text)}'


def format_context_note(note: NodeInput) -> str:
    return note.text or ""


def analyze_sync_bars(
    nodes: list[NodeInput],
    outgoing: dict[str, list[EdgeInput]],
    incoming: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
    lane_map: dict[str, Any],
) -> list[dict[str, Any]]:
    sync_bar_ids = [node.id for node in nodes if node.type == "sync-bar"]
    claimed_join_ids: set[str] = set()
    parallel_blocks: list[dict[str, Any]] = []

    for sync_bar_id in sync_bar_ids:
        sync_bar = node_map[sync_bar_id]
        incoming_nodes = [
            node_map[edge.source_node_id]
            for edge in incoming.get(sync_bar_id, [])
            if edge.source_node_id in node_map and node_map[edge.source_node_id].type != "sync-bar"
        ]
        outgoing_nodes = [
            node_map[edge.target_node_id]
            for edge in outgoing.get(sync_bar_id, [])
            if edge.target_node_id in node_map and node_map[edge.target_node_id].type != "sync-bar"
        ]
        role = classify_sync_bar_role(incoming_nodes, outgoing_nodes)
        if role not in {"fork", "fork_join"}:
            continue

        join_node_id = find_join_candidate(sync_bar_id, outgoing, node_map)
        if join_node_id:
            claimed_join_ids.add(join_node_id)
        branch_summaries = []
        actor_names: list[str] = []
        for branch_node in outgoing_nodes:
            actor_name, summary = summarize_parallel_branch(
                branch_node.id,
                join_node_id,
                outgoing,
                node_map,
                lane_map,
            )
            if actor_name and actor_name not in actor_names:
                actor_names.append(actor_name)
            if summary:
                branch_summaries.append(summary)
        join_summary = summarize_join_follow_up(join_node_id, outgoing, node_map, lane_map)
        parallel_blocks.append(
            {
                "fork_node_id": sync_bar_id,
                "join_node_id": join_node_id,
                "lane_ids": collect_sync_bar_lane_ids(sync_bar, incoming_nodes, outgoing_nodes, lane_map),
                "role": role,
                "actor_names": actor_names,
                "branch_summaries": branch_summaries,
                "join_summary": join_summary,
                "description": describe_parallel_block(branch_summaries, join_summary),
            }
        )

    for sync_bar_id in sync_bar_ids:
        if sync_bar_id in claimed_join_ids:
            continue
        sync_bar = node_map[sync_bar_id]
        incoming_nodes = [
            node_map[edge.source_node_id]
            for edge in incoming.get(sync_bar_id, [])
            if edge.source_node_id in node_map and node_map[edge.source_node_id].type != "sync-bar"
        ]
        outgoing_nodes = [
            node_map[edge.target_node_id]
            for edge in outgoing.get(sync_bar_id, [])
            if edge.target_node_id in node_map and node_map[edge.target_node_id].type != "sync-bar"
        ]
        role = classify_sync_bar_role(incoming_nodes, outgoing_nodes)
        if role != "join":
            continue
        join_summary = summarize_join_follow_up(sync_bar_id, outgoing, node_map, lane_map)
        parallel_blocks.append(
            {
                "fork_node_id": sync_bar_id,
                "join_node_id": sync_bar_id if role == "join" else None,
                "lane_ids": collect_sync_bar_lane_ids(sync_bar, incoming_nodes, outgoing_nodes, lane_map),
                "role": role,
                "actor_names": [
                    lane_title(lane_id, lane_map)
                    for lane_id in collect_sync_bar_lane_ids(sync_bar, incoming_nodes, outgoing_nodes, lane_map)
                    if lane_title(lane_id, lane_map)
                ],
                "branch_summaries": [],
                "join_summary": join_summary,
                "description": (
                    f"Các nhánh song song được đồng bộ trước bước {join_summary}."
                    if join_summary
                    else "Có điểm đồng bộ các nhánh song song."
                ),
            }
        )

    return parallel_blocks


def classify_sync_bar_role(incoming_nodes: list[NodeInput], outgoing_nodes: list[NodeInput]) -> str:
    incoming_count = len(incoming_nodes)
    outgoing_count = len(outgoing_nodes)
    if outgoing_count >= 2 and incoming_count <= 1:
        return "fork"
    if incoming_count >= 2 and outgoing_count <= 1:
        return "join"
    if incoming_count >= 2 and outgoing_count >= 2:
        return "fork_join"
    return "sync"


def collect_sync_bar_lane_ids(
    sync_bar: NodeInput,
    incoming_nodes: list[NodeInput],
    outgoing_nodes: list[NodeInput],
    lane_map: dict[str, Any],
) -> list[str]:
    lane_ids = {
        lane_id
        for lane_id in [
            sync_bar.lane_id,
            *[node.lane_id for node in incoming_nodes],
            *[node.lane_id for node in outgoing_nodes],
        ]
        if lane_id
    }
    return sorted(
        lane_ids,
        key=lambda lane_id: lane_map[lane_id].order if lane_id in lane_map else inf,
    )


def summarize_parallel_branch(
    start_node_id: str,
    join_node_id: str | None,
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
    lane_map: dict[str, Any],
    max_steps: int = 6,
) -> tuple[str | None, str]:
    path_nodes: list[NodeInput] = []
    current_id = start_node_id
    visited: set[str] = set()

    while current_id and current_id not in visited and len(path_nodes) < max_steps:
        if join_node_id and current_id == join_node_id:
            break
        current_node = node_map.get(current_id)
        if not current_node:
            break
        visited.add(current_id)
        if current_node.type != "sync-bar":
            path_nodes.append(current_node)
        if current_node.type in {"end", "decision"}:
            break
        next_edges = outgoing.get(current_id, [])
        if current_node.type == "sync-bar" or len(next_edges) != 1:
            break
        next_id = next_edges[0].target_node_id
        if join_node_id and next_id == join_node_id:
            break
        current_id = next_id

    actor_name = lane_title(next((node.lane_id for node in path_nodes if node.lane_id), None), lane_map)
    summary_steps = [parallel_step_label(node) for node in path_nodes]
    if not summary_steps:
        return actor_name, ""
    if actor_name:
        return actor_name, f"{actor_name}: {' -> '.join(summary_steps)}"
    return actor_name, " -> ".join(summary_steps)


def parallel_step_label(node: NodeInput) -> str:
    if node.type == "decision":
        return f'Ra quyết định "{node.text or "Xác định hướng xử lý"}"'
    if node.type == "end":
        return node.text or "Kết thúc quy trình"
    return node.text or "Thực hiện bước công việc"


def summarize_join_follow_up(
    join_node_id: str | None,
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
    lane_map: dict[str, Any],
) -> str | None:
    if not join_node_id:
        return None
    next_edges = outgoing.get(join_node_id, [])
    if len(next_edges) != 1:
        return None
    next_node = node_map.get(next_edges[0].target_node_id)
    return human_node_label(next_node, lane_map, include_actor=True) if next_node else None


def describe_parallel_block(branch_summaries: list[str], join_summary: str | None) -> str:
    if not branch_summaries:
        if join_summary:
            return f"Các nhánh song song được đồng bộ trước bước {join_summary}."
        return "Có điểm đồng bộ các nhánh song song."

    sentence = "Các nhánh song song gồm: " + "; ".join(branch_summaries) + "."
    if join_summary:
        sentence += f" Sau đó các nhánh hợp nhất trước bước {join_summary}."
    else:
        sentence += " Sau đó các nhánh sẽ cần được hợp nhất lại."
    return sentence


def find_join_candidate(
    sync_bar_id: str,
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
) -> str | None:
    branch_targets = [
        edge.target_node_id
        for edge in outgoing.get(sync_bar_id, [])
        if edge.target_node_id in node_map
    ]
    if len(branch_targets) < 2:
        return None

    branch_sync_distances = [
        reachable_sync_bars(target_id, outgoing, node_map, blocked_sync_bar_id=sync_bar_id)
        for target_id in branch_targets
    ]
    if not branch_sync_distances:
        return None
    common_sync_ids = set(branch_sync_distances[0])
    for distances in branch_sync_distances[1:]:
        common_sync_ids &= set(distances)
    if not common_sync_ids:
        return None
    return min(
        common_sync_ids,
        key=lambda candidate_id: (
            max(distances[candidate_id] for distances in branch_sync_distances),
            sum(distances[candidate_id] for distances in branch_sync_distances),
            candidate_id,
        ),
    )


def reachable_sync_bars(
    start_node_id: str,
    outgoing: dict[str, list[EdgeInput]],
    node_map: dict[str, NodeInput],
    blocked_sync_bar_id: str,
) -> dict[str, int]:
    queue: deque[tuple[str, int]] = deque([(start_node_id, 0)])
    visited: set[str] = set()
    distances: dict[str, int] = {}

    while queue:
        node_id, distance = queue.popleft()
        if node_id in visited or node_id not in node_map:
            continue
        visited.add(node_id)
        node = node_map[node_id]
        if node.type == "sync-bar" and node_id != blocked_sync_bar_id:
            distances[node_id] = distance
            continue
        for edge in outgoing.get(node_id, []):
            queue.append((edge.target_node_id, distance + 1))

    return distances


def lane_title(lane_id: str | None, lane_map: dict[str, Any]) -> str | None:
    if lane_id and lane_id in lane_map:
        return lane_map[lane_id].title
    return None


def human_node_label(
    node: NodeInput | None,
    lane_map: dict[str, Any],
    *,
    include_actor: bool = False,
) -> str:
    if not node:
        return "Bước chưa xác định"

    normalized_text = normalize_inline_text(node.text)
    if node.type == "decision":
        base = f'Ra quyết định "{normalized_text or "Xác định hướng xử lý"}"'
    elif node.type == "end":
        base = normalized_text or "Kết thúc quy trình"
    elif node.type == "start":
        base = normalized_text or "Bắt đầu quy trình"
    elif node.type == "sync-bar":
        base = "Điểm đồng bộ song song"
    else:
        base = normalized_text or "Thực hiện bước công việc"

    actor_name = lane_title(node.lane_id, lane_map) if include_actor else None
    if actor_name:
        return f"[{actor_name}] {base}"
    return base
