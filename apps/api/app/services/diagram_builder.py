from __future__ import annotations

import re

from app.schemas.usecase import (
    DiagramDraft,
    DiagramEdgeDraft,
    DiagramLaneDraft,
    DiagramNodeDraft,
    DiagramTrace,
    UseCaseAlternateFlow,
    UseCaseDraft,
)


LANE_WIDTH = 320
LANE_LEFT = 40
FLOW_TOP = 110
FLOW_GAP = 120


def generate_diagram_draft(use_case: UseCaseDraft) -> DiagramDraft:
    actor_titles = ordered_actors(use_case)
    lanes = [
        DiagramLaneDraft(
            id=f"lane-{index + 1}",
            title=actor,
            order=index,
            width=LANE_WIDTH,
        )
        for index, actor in enumerate(actor_titles)
    ]
    lane_by_actor = {lane.title: lane for lane in lanes}
    lane_x = {
        lane.id: LANE_LEFT + lane.order * LANE_WIDTH + lane.width / 2
        for lane in lanes
    }
    primary_lane = lane_by_actor[use_case.primary_actor]
    nodes: list[DiagramNodeDraft] = []
    edges: list[DiagramEdgeDraft] = []

    start_id = f"{use_case.use_case_id}-start"
    end_id = f"{use_case.use_case_id}-end"
    nodes.append(
        make_node(
            node_id=start_id,
            node_type="start",
            lane_id=primary_lane.id,
            text="",
            x=lane_x[primary_lane.id],
            y=FLOW_TOP,
            trace=trace(use_case.use_case_id, "use_case", use_case.use_case_id),
        )
    )

    main_node_ids: dict[str, str] = {}
    pending_branch_edges: list[tuple[str, UseCaseAlternateFlow]] = []
    previous_id = start_id
    previous_is_decision = False
    y = FLOW_TOP + FLOW_GAP
    flows_by_source: dict[str, list[UseCaseAlternateFlow]] = {}
    for flow in use_case.alternate_flows:
        flows_by_source.setdefault(flow.source_step_id, []).append(flow)

    for step in use_case.main_flow_steps:
        lane = lane_by_actor.get(step.actor_ref, primary_lane)
        node_id = f"node-{slug(step.step_id)}"
        main_node_ids[step.step_id] = node_id
        nodes.append(
            make_node(
                node_id=node_id,
                node_type="activity",
                lane_id=lane.id,
                text=step.action,
                x=lane_x[lane.id],
                y=y,
                trace=trace(use_case.use_case_id, "main_step", step.step_id),
                extra_properties={"expectedResult": step.expected_result},
            )
        )
        edges.append(
            make_edge(
                use_case.use_case_id,
                previous_id,
                node_id,
                f"edge-{slug(previous_id)}-{slug(node_id)}",
                "main_step",
                step.step_id,
                label="Không" if previous_is_decision else None,
            )
        )
        previous_id = node_id
        previous_is_decision = False
        y += FLOW_GAP

        for flow in flows_by_source.get(step.step_id, []):
            decision_id = f"decision-{slug(flow.flow_id)}"
            nodes.append(
                make_node(
                    node_id=decision_id,
                    node_type="decision",
                    lane_id=lane.id,
                    text=flow.condition,
                    x=lane_x[lane.id],
                    y=y,
                    trace=trace(use_case.use_case_id, "alternate_flow", flow.flow_id),
                )
            )
            edges.append(
                make_edge(
                    use_case.use_case_id,
                    previous_id,
                    decision_id,
                    f"edge-{slug(previous_id)}-{slug(decision_id)}",
                    "alternate_flow",
                    flow.flow_id,
                    label="Không" if previous_is_decision else None,
                )
            )
            previous_id = decision_id
            previous_is_decision = True
            y += FLOW_GAP

            branch_previous = decision_id
            for branch_index, branch_step in enumerate(flow.steps):
                branch_lane = lane_by_actor.get(branch_step.actor_ref, primary_lane)
                branch_node_id = f"node-{slug(branch_step.step_id)}"
                nodes.append(
                    make_node(
                        node_id=branch_node_id,
                        node_type="activity",
                        lane_id=branch_lane.id,
                        text=branch_step.action,
                        x=lane_x[branch_lane.id],
                        y=y,
                        trace=trace(use_case.use_case_id, "alternate_flow", flow.flow_id),
                        extra_properties={"sourceStepId": branch_step.step_id},
                    )
                )
                edges.append(
                    make_edge(
                        use_case.use_case_id,
                        branch_previous,
                        branch_node_id,
                        f"edge-{slug(branch_previous)}-{slug(branch_node_id)}",
                        "alternate_flow",
                        flow.flow_id,
                        label="Có" if branch_index == 0 else None,
                    )
                )
                branch_previous = branch_node_id
                y += FLOW_GAP
            if flow.rejoin_step_id:
                pending_branch_edges.append((branch_previous, flow))
            else:
                outcome_id = f"outcome-{slug(flow.flow_id)}"
                terminal_end_id = f"end-{slug(flow.flow_id)}"
                nodes.append(
                    make_node(
                        node_id=outcome_id,
                        node_type="activity",
                        lane_id=primary_lane.id,
                        text=flow.terminal_outcome or "Kết thúc luồng thay thế.",
                        x=lane_x[primary_lane.id],
                        y=y,
                        trace=trace(
                            use_case.use_case_id,
                            "terminal_outcome",
                            flow.flow_id,
                        ),
                    )
                )
                edges.append(
                    make_edge(
                        use_case.use_case_id,
                        branch_previous,
                        outcome_id,
                        f"edge-{slug(branch_previous)}-{slug(outcome_id)}",
                        "terminal_outcome",
                        flow.flow_id,
                    )
                )
                y += FLOW_GAP
                nodes.append(
                    make_node(
                        node_id=terminal_end_id,
                        node_type="end",
                        lane_id=primary_lane.id,
                        text="",
                        x=lane_x[primary_lane.id],
                        y=y,
                        trace=trace(
                            use_case.use_case_id,
                            "terminal_outcome",
                            flow.flow_id,
                        ),
                    )
                )
                edges.append(
                    make_edge(
                        use_case.use_case_id,
                        outcome_id,
                        terminal_end_id,
                        f"edge-{slug(outcome_id)}-{slug(terminal_end_id)}",
                        "terminal_outcome",
                        flow.flow_id,
                        label="Kết thúc",
                    )
                )
                y += FLOW_GAP

    nodes.append(
        make_node(
            node_id=end_id,
            node_type="end",
            lane_id=primary_lane.id,
            text="",
            x=lane_x[primary_lane.id],
            y=y + FLOW_GAP,
            trace=trace(use_case.use_case_id, "success_outcome", use_case.use_case_id),
        )
    )
    edges.append(
        make_edge(
            use_case.use_case_id,
            previous_id,
            end_id,
            f"edge-{slug(previous_id)}-{slug(end_id)}",
            "success_outcome",
            use_case.use_case_id,
            label="Không" if previous_is_decision else "Tiếp tục",
        )
    )

    for branch_previous, flow in pending_branch_edges:
        target_id = main_node_ids.get(flow.rejoin_step_id or "", end_id)
        edges.append(
            make_edge(
                use_case.use_case_id,
                branch_previous,
                target_id,
                f"edge-{slug(branch_previous)}-{slug(target_id)}",
                "alternate_flow",
                flow.flow_id,
                label="Quay lại" if flow.rejoin_step_id else "Kết thúc",
            )
        )

    diagram = DiagramDraft(
        diagram_id=f"diagram-{slug(use_case.use_case_id)}",
        use_case_id=use_case.use_case_id,
        title=use_case.title,
        lanes=lanes,
        nodes=nodes,
        edges=deduplicate_edges(edges),
    )
    validate_graph_ids(diagram)
    return diagram


def ordered_actors(use_case: UseCaseDraft) -> list[str]:
    referenced = {step.actor_ref for step in use_case.main_flow_steps} | {
        step.actor_ref
        for flow in use_case.alternate_flows
        for step in flow.steps
    }
    result: list[str] = []
    for actor in [use_case.primary_actor, *use_case.supporting_actors]:
        if (actor in referenced or actor == use_case.primary_actor) and actor not in result:
            result.append(actor)
    return result or [use_case.primary_actor]


def make_node(
    *,
    node_id: str,
    node_type: str,
    lane_id: str,
    text: str,
    x: float,
    y: float,
    trace: DiagramTrace,
    extra_properties: dict[str, object] | None = None,
) -> DiagramNodeDraft:
    return DiagramNodeDraft(
        id=node_id,
        type=node_type,  # type: ignore[arg-type]
        lane_id=lane_id,
        text=text,
        x=x,
        y=y,
        properties={
            "laneId": lane_id,
            "trace": trace.model_dump(mode="json"),
            **(extra_properties or {}),
        },
        trace=trace,
    )


def make_edge(
    use_case_id: str,
    source_id: str,
    target_id: str,
    edge_id: str,
    source_kind: str,
    source_ref: str,
    label: str | None = None,
) -> DiagramEdgeDraft:
    return DiagramEdgeDraft(
        id=edge_id,
        source_node_id=source_id,
        target_node_id=target_id,
        label=label,
        trace=trace(use_case_id, source_kind, source_ref),
    )


def trace(use_case_id: str, source_kind: str, source_id: str) -> DiagramTrace:
    return DiagramTrace(
        use_case_id=use_case_id,
        source_kind=source_kind,  # type: ignore[arg-type]
        source_id=source_id,
    )


def deduplicate_edges(edges: list[DiagramEdgeDraft]) -> list[DiagramEdgeDraft]:
    seen: set[tuple[str, str]] = set()
    result: list[DiagramEdgeDraft] = []
    for edge in edges:
        key = (edge.source_node_id, edge.target_node_id)
        if key in seen:
            continue
        seen.add(key)
        result.append(edge)
    return result


def slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()


def validate_graph_ids(diagram: DiagramDraft) -> None:
    node_ids = [node.id for node in diagram.nodes]
    edge_ids = [edge.id for edge in diagram.edges]
    if len(set(node_ids)) != len(node_ids):
        raise ValueError("DiagramDraft chua node id bi trung.")
    if len(set(edge_ids)) != len(edge_ids):
        raise ValueError("DiagramDraft chua edge id bi trung.")
