from __future__ import annotations

from collections import defaultdict

from app.schemas.common import WarningItem
from app.schemas.request import DiagramSemanticRequest, NodeInput


def _warning(code: str, severity: str, message: str, related_node_ids: list[str] | None = None) -> WarningItem:
    return WarningItem(
        code=code,
        severity=severity,  # type: ignore[arg-type]
        message=message,
        related_node_ids=related_node_ids or [],
    )


def validate_request(payload: DiagramSemanticRequest) -> tuple[list[WarningItem], list[WarningItem]]:
    warnings: list[WarningItem] = []
    blocking_issues: list[WarningItem] = []
    node_map = {node.id: node for node in payload.nodes}
    start_nodes = [node for node in payload.nodes if node.type == "start"]
    end_nodes = [node for node in payload.nodes if node.type == "end"]

    if not payload.lanes:
        blocking_issues.append(_warning("LANE_REQUIRED", "blocking", "Diagram cần ít nhất 1 lane."))
    if not start_nodes:
        blocking_issues.append(_warning("START_REQUIRED", "blocking", "Diagram cần ít nhất 1 node start."))
    if not end_nodes:
        blocking_issues.append(_warning("END_REQUIRED", "blocking", "Diagram cần ít nhất 1 node end."))

    for node in payload.nodes:
        if node.type in {"activity", "decision"} and not node.lane_id:
            blocking_issues.append(
                _warning(
                    "NODE_MISSING_LANE",
                    "blocking",
                    f'Node "{node.id}" chưa thuộc lane nào.',
                    [node.id],
                )
            )

    outgoing: dict[str, list[tuple[str, str | None]]] = defaultdict(list)
    for edge in payload.edges:
        if edge.source_node_id not in node_map or edge.target_node_id not in node_map:
            blocking_issues.append(
                _warning(
                    "EDGE_ENDPOINT_INVALID",
                    "blocking",
                    f'Edge "{edge.id}" tham chiếu node không tồn tại.',
                    [edge.source_node_id, edge.target_node_id],
                )
            )
            continue
        outgoing[edge.source_node_id].append((edge.target_node_id, edge.label))

    for node in payload.nodes:
        if node.type == "decision":
            for target_node_id, label in outgoing.get(node.id, []):
                if not label:
                    warnings.append(
                        _warning(
                            "DECISION_UNLABELED",
                            "warning",
                            f'Nhánh từ decision "{node.text or node.id}" chưa có label.',
                            [node.id, target_node_id],
                        )
                    )
        if node.type == "note":
            if not resolve_note_anchor(node, payload.nodes):
                warnings.append(
                    _warning(
                        "NOTE_ORPHAN",
                        "warning",
                        f'Note "{node.text or node.id}" chưa gắn gần node flow nào.',
                        [node.id],
                    )
                )
        if node.type == "sync-bar":
            attached = [
                edge
                for edge in payload.edges
                if edge.source_node_id == node.id or edge.target_node_id == node.id
            ]
            if len(attached) < 2:
                warnings.append(
                    _warning(
                        "SYNC_BAR_SPAN_AMBIGUOUS",
                        "warning",
                        f'Sync-bar "{node.id}" chưa đủ kết nối để suy ra span lane.',
                        [node.id],
                    )
                )

    cycle_nodes = detect_cycle_nodes(payload.nodes, payload.edges)
    if cycle_nodes:
        warnings.append(
            _warning(
                "GRAPH_HAS_LOOP",
                "warning",
                "Diagram có cycle/retry flow; backend sẽ ghi nhận vào loops thay vì fail.",
                cycle_nodes,
            )
        )

    return warnings, blocking_issues


def detect_cycle_nodes(nodes: list[NodeInput], edges) -> list[str]:
    graph: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        graph[edge.source_node_id].append(edge.target_node_id)

    visited: set[str] = set()
    visiting: set[str] = set()
    cycle_nodes: set[str] = set()

    def dfs(node_id: str) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle_nodes.add(node_id)
            return
        visiting.add(node_id)
        for next_node_id in graph.get(node_id, []):
            if next_node_id in visiting:
                cycle_nodes.update({node_id, next_node_id})
            dfs(next_node_id)
        visiting.remove(node_id)
        visited.add(node_id)

    for node in nodes:
        dfs(node.id)

    return sorted(cycle_nodes)


def resolve_note_anchor(note: NodeInput, nodes: list[NodeInput], max_distance: float = 220.0) -> NodeInput | None:
    explicit_anchor_id = note.metadata.get("anchor_node_id") or note.metadata.get("anchorNodeId")
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


def note_distance(note: NodeInput, candidate: NodeInput) -> float:
    return abs(note.x - candidate.x) + abs(note.y - candidate.y)
