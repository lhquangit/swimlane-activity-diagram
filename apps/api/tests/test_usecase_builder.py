from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.schemas.usecase import FeatureIntent, ProjectSpec
from app.services.usecase_builder import generate_use_case_drafts


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "usecase_generation"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def classify_use_case_kind(title: str) -> str:
    if "tiếp nhận và khởi tạo xử lý" in title:
        return "intake"
    if "phối hợp actor và hệ thống" in title:
        return "coordination"
    if "ngoại lệ, từ chối, hoặc điều chỉnh" in title:
        return "exception"
    if "thực hiện xử lý chính" in title:
        return "execution"
    return "unknown"


def test_generate_use_case_drafts_can_return_single_execution_use_case() -> None:
    project_spec = ProjectSpec(
        project_name="TinyFlow",
        project_summary="Xu ly mot tac vu don gian noi bo.",
    )
    feature_intent = FeatureIntent(
        feature_name="Dong bo trang thai",
        feature_summary="Cap nhat trang thai cho mot doi tuong nghiep vu.",
    )

    use_cases = generate_use_case_drafts(project_spec, feature_intent)

    assert len(use_cases) == 1
    assert use_cases[0].title.endswith("thực hiện xử lý chính cho Dong bo trang thai")


def test_generate_use_case_drafts_adds_coordination_and_exception_when_signal_is_rich() -> None:
    project_spec = ProjectSpec(
        project_name="V-PetSafe",
        project_summary="Nen tang quan ly cu dan va dich vu noi khu.",
        business_context="Ban quan ly can xu ly yeu cau GPS cho thu nuoi.",
        target_users=["Ban quan ly", "Cu dan"],
        business_rules=[
            "Chi cap phat thiet bi khi co GPS Device kha dung.",
            "Phai luu lich su thay doi trang thai.",
        ],
        glossary=["GPS Device", "Portal", "V-app"],
    )
    feature_intent = FeatureIntent(
        feature_name="Cap phat GPS Device",
        function_name="gps-device-issue",
        feature_summary="Xu ly yeu cau cap phat va lap dat GPS cho thu nuoi.",
        primary_actor="Ban quan ly",
        trigger="Co yeu cau dang ky GPS hop le tu cu dan.",
        inputs=["Yeu cau GPS", "Danh sach GPS Device trong kho"],
        outputs=["Trang thai yeu cau", "Trang thai GPS Device", "Thong bao cu dan"],
        constraints=["Thiet bi phai o trang thai Trong kho truoc khi giu cho."],
        assumptions=["Portal la he thong thao tac chinh cua BQL."],
        systems_involved=["Portal", "V-app"],
        success_outcome="Yeu cau GPS duoc cap phat thanh cong va cu dan nhan duoc thong bao.",
    )

    use_cases = generate_use_case_drafts(project_spec, feature_intent)

    assert len(use_cases) == 4
    assert any("phối hợp actor và hệ thống" in use_case.title for use_case in use_cases)
    assert any("ngoại lệ" in use_case.title for use_case in use_cases)
    assert all(use_case.main_flow_steps for use_case in use_cases)
    assert all(
        step.actor_ref in {use_case.primary_actor, *use_case.supporting_actors}
        for use_case in use_cases
        for step in use_case.main_flow_steps
    )
    assert all(flow.source_step_id for use_case in use_cases for flow in use_case.alternate_flows)


def test_generate_use_case_drafts_can_skip_coordination_but_keep_exception() -> None:
    project_spec = ProjectSpec(
        project_name="ClaimFlow",
        project_summary="Xu ly tu choi yeu cau boi thuong.",
        business_rules=["Can ghi lai ly do tu choi."],
    )
    feature_intent = FeatureIntent(
        feature_name="Từ chối yêu cầu bồi thường",
        feature_summary="Danh gia dieu kien va tu choi yeu cau khi khong hop le.",
        primary_actor="Tham dinh vien",
        trigger="Ho so boi thuong duoc gui vao he thong.",
        outputs=["Trang thai ho so"],
    )

    use_cases = generate_use_case_drafts(project_spec, feature_intent)

    assert len(use_cases) == 3
    assert all("phối hợp actor và hệ thống" not in use_case.title for use_case in use_cases)
    assert any("ngoại lệ" in use_case.title for use_case in use_cases)


def test_constraints_have_an_observable_exception_effect() -> None:
    project_spec = ProjectSpec(
        project_name="Simple",
        project_summary="A simple internal workflow.",
    )
    base_intent = FeatureIntent(
        feature_name="Update status",
        feature_summary="Update one status.",
        primary_actor="Operator",
    )

    without_constraints = generate_use_case_drafts(project_spec, base_intent)
    with_constraints = generate_use_case_drafts(
        project_spec,
        base_intent.model_copy(
            update={"constraints": ["Only approved requests can be updated."]}
        ),
    )

    assert not any("ngoại lệ" in use_case.title for use_case in without_constraints)
    assert any("ngoại lệ" in use_case.title for use_case in with_constraints)


def test_outputs_have_an_observable_workflow_effect() -> None:
    project_spec = ProjectSpec(
        project_name="Simple",
        project_summary="A simple internal workflow.",
    )
    intent = FeatureIntent(
        feature_name="Update status",
        feature_summary="Update one status.",
        primary_actor="Operator",
        outputs=["Request status", "Audit event"],
    )

    use_cases = generate_use_case_drafts(project_spec, intent)

    assert any(
        "Request status, Audit event" in step.action
        for use_case in use_cases
        for step in use_case.main_flow_steps
    )


def test_deprecated_function_name_and_glossary_do_not_change_generation() -> None:
    base_project = ProjectSpec(
        project_name="Simple",
        project_summary="A simple internal workflow.",
    )
    base_intent = FeatureIntent(
        feature_name="Update status",
        feature_summary="Update one status.",
        primary_actor="Operator",
    )

    baseline = generate_use_case_drafts(base_project, base_intent)
    enriched = generate_use_case_drafts(
        base_project.model_copy(update={"glossary": ["Internal term"]}),
        base_intent.model_copy(update={"function_name": "update-status"}),
    )

    assert enriched == baseline


@pytest.mark.parametrize(
    ("fixture_name", "expected_count", "expected_primary_actor", "expected_kinds"),
    [
        ("gps-device-issue.json", 4, "Ban quản lý", ["intake", "execution", "coordination", "exception"]),
        (
            "fire-incident-response.json",
            4,
            "Nhân sự vận hành liên lạc (VOC)",
            ["intake", "execution", "coordination", "exception"],
        ),
        ("swimlane-theme-update.json", 1, "Product designer", ["execution"]),
    ],
)
def test_generate_use_case_drafts_match_domain_fixtures(
    fixture_name: str,
    expected_count: int,
    expected_primary_actor: str,
    expected_kinds: list[str],
) -> None:
    fixture = load_fixture(fixture_name)
    project_spec = ProjectSpec(**fixture["project_spec"])
    feature_intent = FeatureIntent(**fixture["feature_intent"])

    use_cases = generate_use_case_drafts(project_spec, feature_intent)

    assert len(use_cases) == expected_count
    assert all(use_case.primary_actor == expected_primary_actor for use_case in use_cases)
    assert [classify_use_case_kind(use_case.title) for use_case in use_cases] == expected_kinds
