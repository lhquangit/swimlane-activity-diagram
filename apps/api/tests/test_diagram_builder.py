from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.usecase import (
    UseCaseAlternateFlow,
    UseCaseDraft,
    UseCaseFlowStep,
)
from app.services.diagram_builder import generate_diagram_draft


def approved_use_case() -> UseCaseDraft:
    return UseCaseDraft(
        use_case_id="UC-ORDER-01",
        title="Điều phối viên xử lý yêu cầu",
        objective="Xử lý yêu cầu đúng quy trình.",
        primary_actor="Điều phối viên",
        supporting_actors=["Hệ thống"],
        preconditions=["Yêu cầu hợp lệ."],
        happy_path_summary=["Tiếp nhận yêu cầu", "Hệ thống cập nhật trạng thái"],
        key_exceptions=["Thiếu thông tin"],
        main_flow_steps=[
            UseCaseFlowStep(
                step_id="UC-ORDER-01-S01",
                actor_ref="Điều phối viên",
                action="Tiếp nhận yêu cầu",
                input_or_trigger="Có yêu cầu mới",
                expected_result="Yêu cầu được ghi nhận.",
            ),
            UseCaseFlowStep(
                step_id="UC-ORDER-01-S02",
                actor_ref="Hệ thống",
                action="Hệ thống cập nhật trạng thái",
                expected_result="Trạng thái được lưu.",
            ),
        ],
        alternate_flows=[
            UseCaseAlternateFlow(
                flow_id="UC-ORDER-01-AF01",
                source_step_id="UC-ORDER-01-S01",
                condition="Thiếu thông tin",
                steps=[
                    UseCaseFlowStep(
                        step_id="UC-ORDER-01-AF01-S01",
                        actor_ref="Điều phối viên",
                        action="Yêu cầu bổ sung thông tin",
                        expected_result="Yêu cầu tạm dừng.",
                    )
                ],
                rejoin_step_id="UC-ORDER-01-S02",
            )
        ],
        success_outcome="Yêu cầu được xử lý.",
        review_status="approved",
    )


def test_generate_diagram_draft_builds_actor_lanes_and_traceable_graph() -> None:
    diagram = generate_diagram_draft(approved_use_case())

    assert [lane.title for lane in diagram.lanes] == ["Điều phối viên", "Hệ thống"]
    assert {node.type for node in diagram.nodes} >= {"start", "activity", "decision", "end"}
    assert all(node.trace.use_case_id == "UC-ORDER-01" for node in diagram.nodes)
    assert all(edge.trace.use_case_id == "UC-ORDER-01" for edge in diagram.edges)
    assert any(
        node.trace.source_kind == "main_step"
        and node.trace.source_id == "UC-ORDER-01-S02"
        and node.lane_id == "lane-2"
        for node in diagram.nodes
    )
    assert any(edge.label == "Có" for edge in diagram.edges)
    assert any(edge.label == "Không" for edge in diagram.edges)
    assert all(edge.label != "Thiếu thông tin" for edge in diagram.edges)

    positioned_nodes = [node for node in diagram.nodes if node.type in {"activity", "decision"}]
    assert len({node.y for node in positioned_nodes}) == len(positioned_nodes)


def test_use_case_contract_rejects_empty_main_flow() -> None:
    payload = approved_use_case().model_dump()
    payload["main_flow_steps"] = []

    with pytest.raises(ValidationError, match="main_flow_steps"):
        UseCaseDraft.model_validate(payload)


def test_use_case_contract_rejects_duplicate_or_colliding_step_ids() -> None:
    payload = approved_use_case().model_dump()
    payload["alternate_flows"].append(
        {
            "flow_id": "UC-ORDER-01-AF02",
            "source_step_id": "UC-ORDER-01-S01",
            "condition": "Dữ liệu trùng",
            "steps": [
                {
                    "step_id": "UC ORDER 01 AF01 S01",
                    "actor_ref": "Điều phối viên",
                    "action": "Kiểm tra dữ liệu trùng",
                    "expected_result": "Đã kiểm tra.",
                }
            ],
            "terminal_outcome": "Dừng xử lý.",
        }
    )
    payload["alternate_flows"][0]["steps"][0]["step_id"] = "UC-ORDER-01-AF01-S01"

    with pytest.raises(ValidationError, match="graph node id"):
        UseCaseDraft.model_validate(payload)


def test_alternate_flow_requires_exactly_one_outcome_mode() -> None:
    payload = approved_use_case().model_dump()
    payload["alternate_flows"][0]["terminal_outcome"] = "Dừng xử lý."

    with pytest.raises(ValidationError, match="dung mot outcome"):
        UseCaseDraft.model_validate(payload)


def test_terminal_alternate_flow_uses_dedicated_outcome_and_end() -> None:
    payload = approved_use_case().model_dump()
    flow = payload["alternate_flows"][0]
    flow["rejoin_step_id"] = None
    flow["terminal_outcome"] = "Yêu cầu bị từ chối."
    use_case = UseCaseDraft.model_validate(payload)

    diagram = generate_diagram_draft(use_case)
    success_end = next(
        node for node in diagram.nodes if node.trace.source_kind == "success_outcome"
    )
    terminal_nodes = [
        node
        for node in diagram.nodes
        if node.trace.source_kind == "terminal_outcome"
    ]
    terminal_outcome = next(node for node in terminal_nodes if node.type == "activity")
    terminal_end = next(node for node in terminal_nodes if node.type == "end")

    assert terminal_outcome.text == "Yêu cầu bị từ chối."
    assert any(
        edge.source_node_id == terminal_outcome.id
        and edge.target_node_id == terminal_end.id
        for edge in diagram.edges
    )
    assert not any(
        edge.source_node_id == terminal_outcome.id
        and edge.target_node_id == success_end.id
        for edge in diagram.edges
    )
