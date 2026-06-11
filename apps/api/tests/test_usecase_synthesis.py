from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.usecase import FeatureIntent, ProjectSpec
from app.usecases.grounding import validate_grounding
from app.usecases.hydrator import HydrationError, hydrate_synthesis
from app.usecases.quality import evaluate_synthesis
from app.usecases.synthesis_schema import UseCaseSynthesisResult


QUALITY_FIXTURE_DIR = Path(__file__).parent / "fixtures" / "usecase_synthesis_quality"


def project_and_intent() -> tuple[ProjectSpec, FeatureIntent]:
    return (
        ProjectSpec(
            project_name="V-PetSafe",
            project_summary="Quản lý yêu cầu GPS.",
            target_users=["Ban quản lý", "Cư dân"],
        ),
        FeatureIntent(
            feature_name="Cấp phát GPS",
            feature_summary="Cấp thiết bị GPS còn trong kho cho cư dân.",
            primary_actor="Ban quản lý",
            trigger="Cư dân gửi yêu cầu GPS.",
            inputs=["Yêu cầu GPS", "Thiết bị trong kho"],
            outputs=["Trạng thái yêu cầu"],
            constraints=["Chỉ cấp thiết bị còn trong kho."],
            success_outcome="Thiết bị được gán cho yêu cầu.",
        ),
    )


def valid_synthesis_payload() -> dict:
    return {
        "use_cases": [
            {
                "title": "Ban quản lý cấp phát thiết bị GPS",
                "objective": "Gán một thiết bị còn trong kho cho yêu cầu hợp lệ.",
                "primary_actor": "Ban quản lý",
                "supporting_actors": ["Cư dân"],
                "preconditions": ["Cư dân đã gửi yêu cầu GPS."],
                "main_flow_steps": [
                    {
                        "actor": "Ban quản lý",
                        "action": "Mở yêu cầu GPS của cư dân.",
                        "input_or_trigger": "Yêu cầu GPS",
                        "expected_result": "Thông tin yêu cầu được hiển thị.",
                        "evidence_refs": ["feature.inputs.0"],
                    },
                    {
                        "actor": "Ban quản lý",
                        "action": "Chọn thiết bị đang còn trong kho và gán cho yêu cầu.",
                        "input_or_trigger": "Thiết bị trong kho",
                        "expected_result": "Thiết bị được giữ cho yêu cầu.",
                        "evidence_refs": ["feature.inputs.1", "feature.constraints.0"],
                    },
                ],
                "alternate_flows": [
                    {
                        "source_step_number": 2,
                        "condition": "Không còn thiết bị trong kho.",
                        "steps": [
                            {
                                "actor": "Ban quản lý",
                                "action": "Đánh dấu yêu cầu chờ thiết bị.",
                                "input_or_trigger": None,
                                "expected_result": "Yêu cầu chưa được cấp thiết bị.",
                                "evidence_refs": ["feature.constraints.0"],
                            }
                        ],
                        "rejoin_step_number": None,
                        "terminal_outcome": "Yêu cầu chờ bổ sung thiết bị.",
                        "evidence_refs": ["feature.constraints.0"],
                    }
                ],
                "success_outcome": "Thiết bị được gán cho yêu cầu.",
                "evidence_refs": [
                    "feature.feature_summary",
                    "feature.success_outcome",
                ],
            }
        ]
    }


def load_quality_fixture(name: str) -> dict:
    return json.loads((QUALITY_FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_hydrator_is_deterministic_and_derives_compatibility_summaries() -> None:
    project, intent = project_and_intent()
    synthesis = UseCaseSynthesisResult.model_validate(valid_synthesis_payload())

    first = hydrate_synthesis(synthesis, project, intent)
    second = hydrate_synthesis(synthesis, project, intent)

    assert first == second
    assert first[0].main_flow_steps[0].step_id.endswith("-S01")
    assert first[0].alternate_flows[0].source_step_id.endswith("-S02")
    assert first[0].happy_path_summary == [
        step.action for step in first[0].main_flow_steps
    ]
    assert first[0].review_status == "draft"


def test_hydrator_rejects_invalid_step_reference() -> None:
    project, intent = project_and_intent()
    payload = valid_synthesis_payload()
    payload["use_cases"][0]["alternate_flows"][0]["source_step_number"] = 9

    with pytest.raises(HydrationError):
        hydrate_synthesis(
            UseCaseSynthesisResult.model_validate(payload), project, intent
        )


def test_semantic_schema_requires_exactly_one_alternate_outcome() -> None:
    payload = valid_synthesis_payload()
    flow = payload["use_cases"][0]["alternate_flows"][0]
    flow["rejoin_step_number"] = 1

    with pytest.raises(ValidationError):
        UseCaseSynthesisResult.model_validate(payload)


def test_grounding_rejects_unknown_actor_and_evidence_ref() -> None:
    project, intent = project_and_intent()
    payload = valid_synthesis_payload()
    payload["use_cases"][0]["supporting_actors"] = ["Giám đốc giả"]
    payload["use_cases"][0]["main_flow_steps"][0]["evidence_refs"] = [
        "system.secret"
    ]
    issues = validate_grounding(
        UseCaseSynthesisResult.model_validate(payload), project, intent
    )

    assert {issue.code for issue in issues} == {
        "UNSUPPORTED_ACTOR",
        "UNKNOWN_EVIDENCE_REF",
    }


def test_grounding_accepts_feature_actors_and_demands_technical_actor_coverage() -> None:
    project, intent = project_and_intent()
    intent = intent.model_copy(
        update={
            "actors": ["Ban quản lý", "Camera AI"],
            "systems_involved": ["Dịch vụ Re-ID"],
        }
    )
    payload = valid_synthesis_payload()
    payload["use_cases"][0]["supporting_actors"] = ["Camera AI"]
    payload["use_cases"][0]["main_flow_steps"][0]["actor"] = "Camera AI"
    payload["use_cases"][0]["main_flow_steps"][0]["evidence_refs"] = ["feature.actors.1"]

    issues = validate_grounding(
        UseCaseSynthesisResult.model_validate(payload), project, intent
    )

    assert issues == []

    payload_without_technical_actor = valid_synthesis_payload()
    payload_without_technical_actor["use_cases"][0]["supporting_actors"] = ["Camera AI"]
    issues_without_coverage = validate_grounding(
        UseCaseSynthesisResult.model_validate(payload_without_technical_actor), project, intent
    )

    assert {issue.code for issue in issues_without_coverage} == {
        "MISSING_TECHNICAL_ACTOR_COVERAGE"
    }


def test_quality_gate_rejects_generic_and_duplicate_flows() -> None:
    payload = valid_synthesis_payload()
    first = payload["use_cases"][0]
    first["main_flow_steps"][0]["action"] = "Hệ thống xử lý yêu cầu"
    first["main_flow_steps"][1]["action"] = "Cập nhật kết quả phù hợp"
    payload["use_cases"].append({**first, "title": "Use case thứ hai"})

    quality = evaluate_synthesis(UseCaseSynthesisResult.model_validate(payload))

    assert quality.status == "rejected"
    assert {"GENERIC_OUTPUT", "DUPLICATE_FLOW"} <= {
        issue.code for issue in quality.issues
    }


def test_quality_gate_rejects_missing_technical_actor_coverage() -> None:
    project, intent = project_and_intent()
    intent = intent.model_copy(
        update={
            "actors": ["Ban quản lý", "Camera AI"],
            "systems_involved": ["Dịch vụ Re-ID"],
        }
    )

    quality = evaluate_synthesis(
        UseCaseSynthesisResult.model_validate(valid_synthesis_payload()),
        intent,
    )

    assert quality.status == "rejected"
    assert "MISSING_TECHNICAL_ACTOR_COVERAGE" in {
        issue.code for issue in quality.issues
    }


@pytest.mark.parametrize(
    ("title", "actions"),
    [
        (
            "Ban quản lý cấp phát GPS",
            [
                "Đối chiếu yêu cầu GPS với thiết bị còn trong kho.",
                "Gán mã thiết bị đã chọn cho yêu cầu của cư dân.",
            ],
        ),
        (
            "VOC điều phối sự cố cháy",
            [
                "Xác minh vị trí và mức độ của tín hiệu báo cháy.",
                "Chuyển thông tin đã xác minh cho đội phản ứng tại hiện trường.",
            ],
        ),
        (
            "Nhân viên cập nhật hồ sơ khách hàng",
            [
                "Mở hồ sơ khách hàng theo mã được cung cấp.",
                "Lưu các trường đã thay đổi và ghi nhận thời điểm cập nhật.",
            ],
        ),
    ],
)
def test_quality_golden_domains_accept_specific_flows(
    title: str, actions: list[str]
) -> None:
    payload = valid_synthesis_payload()
    payload["use_cases"][0]["title"] = title
    for step, action in zip(
        payload["use_cases"][0]["main_flow_steps"], actions, strict=True
    ):
        step["action"] = action

    assert (
        evaluate_synthesis(UseCaseSynthesisResult.model_validate(payload)).status
        == "passed"
    )


@pytest.mark.parametrize(
    "fixture_name",
    [
        "gps-device-issue-accepted.json",
        "camera-reid-accepted.json",
        "pet-points-accepted.json",
        "guest-vehicle-accepted.json",
        "maintenance-ticket-accepted.json",
    ],
)
def test_quality_acceptance_goldens_pass_for_domain_specific_synthesis(
    fixture_name: str,
) -> None:
    fixture = load_quality_fixture(fixture_name)
    feature_intent = FeatureIntent(**fixture["feature_intent"])
    synthesis = UseCaseSynthesisResult.model_validate(fixture["synthesis"])

    quality = evaluate_synthesis(synthesis, feature_intent)

    assert quality.status == "passed"


def test_quality_acceptance_golden_rejects_scaffold_like_template_output() -> None:
    fixture = load_quality_fixture("generic-template-rejected.json")
    feature_intent = FeatureIntent(**fixture["feature_intent"])
    synthesis = UseCaseSynthesisResult.model_validate(fixture["synthesis"])

    quality = evaluate_synthesis(synthesis, feature_intent)

    assert quality.status == "rejected"
    assert set(fixture["expected_issue_codes"]).issubset(
        {issue.code for issue in quality.issues}
    )


def test_quality_acceptance_rejects_mixed_portfolio_when_one_use_case_lacks_business_trace() -> None:
    fixture = load_quality_fixture("mixed-portfolio-missing-trace-rejected.json")
    feature_intent = FeatureIntent(**fixture["feature_intent"])
    synthesis = UseCaseSynthesisResult.model_validate(fixture["synthesis"])

    quality = evaluate_synthesis(synthesis, feature_intent)

    assert quality.status == "rejected"
    assert set(fixture["expected_issue_codes"]).issubset(
        {issue.code for issue in quality.issues}
    )
    assert any(
        fixture["offending_use_case_title"] in issue.message
        for issue in quality.issues
    )


@pytest.mark.parametrize(
    "fixture_name",
    [
        "pet-points-too-broad-rejected.json",
        "guest-vehicle-too-broad-rejected.json",
        "maintenance-ticket-too-broad-rejected.json",
    ],
)
def test_quality_acceptance_rejects_real_complaint_domains_when_boundaries_stay_scaffold_like(
    fixture_name: str,
) -> None:
    fixture = load_quality_fixture(fixture_name)
    feature_intent = FeatureIntent(**fixture["feature_intent"])
    synthesis = UseCaseSynthesisResult.model_validate(fixture["synthesis"])

    quality = evaluate_synthesis(synthesis, feature_intent)

    assert quality.status == "rejected"
    assert set(fixture["expected_issue_codes"]).issubset(
        {issue.code for issue in quality.issues}
    )
    assert any(
        fixture["offending_use_case_title"] in issue.message
        for issue in quality.issues
    )
