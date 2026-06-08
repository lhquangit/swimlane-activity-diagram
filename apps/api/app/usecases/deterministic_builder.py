"""Deterministic use-case generator and AI fallback."""

from __future__ import annotations

import re

from app.schemas.usecase import ArtifactChainItem
from app.schemas.usecase import FeatureIntent
from app.schemas.usecase import ProjectSpec
from app.schemas.usecase import UseCaseAlternateFlow
from app.schemas.usecase import UseCaseDraft
from app.schemas.usecase import UseCaseFlowStep

from .actor_signals import is_technical_actor


def build_artifact_chain() -> list[ArtifactChainItem]:
    return [
        ArtifactChainItem(
            artifact_type="project_spec",
            label="ProjectSpec",
            source_of_truth=True,
            human_editable=True,
            generated_from=[],
            notes="Mô tả bối cảnh nghiệp vụ và ranh giới bài toán ở cấp dự án.",
        ),
        ArtifactChainItem(
            artifact_type="feature_intent",
            label="FeatureIntent",
            source_of_truth=True,
            human_editable=True,
            generated_from=["project_spec"],
            notes="Ý định chức năng cần build cho một module hoặc bài toán cụ thể.",
        ),
        ArtifactChainItem(
            artifact_type="use_case_draft",
            label="UseCaseDraft",
            source_of_truth=False,
            human_editable=True,
            generated_from=["project_spec", "feature_intent"],
            notes="Danh sách use case để BA/Solution Engineer review trước khi sinh diagram.",
        ),
        ArtifactChainItem(
            artifact_type="diagram_draft",
            label="DiagramDraft",
            source_of_truth=False,
            human_editable=True,
            generated_from=["use_case_draft"],
            notes="Swimlane activity diagram draft cho từng use case đã được approve.",
        ),
        ArtifactChainItem(
            artifact_type="formal_brd_draft",
            label="FormalBRDDraft",
            source_of_truth=False,
            human_editable=True,
            generated_from=["project_spec", "use_case_draft", "diagram_draft"],
            notes="BRD tổng hợp theo format formal sau khi use case và diagram đã ổn định.",
        ),
    ]


def generate_use_case_drafts(
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
) -> list[UseCaseDraft]:
    feature_label = feature_intent.feature_name.strip()
    primary_actor = (
        feature_intent.primary_actor
        or next(iter(feature_intent.actors), None)
        or next(iter(project_spec.target_users), None)
        or "Người dùng nghiệp vụ"
    )
    supporting_actors = unique_values(
        [
            *feature_intent.actors,
            *project_spec.target_users,
            *feature_intent.systems_involved,
        ],
        exclude={primary_actor},
    )

    uc_prefix = build_use_case_prefix(project_spec.project_name, feature_label)
    generic_preconditions = build_generic_preconditions(project_spec, feature_intent)

    use_cases: list[UseCaseDraft] = []
    sequence = 1

    if should_create_intake_use_case(project_spec, feature_intent, supporting_actors):
        use_cases.append(
            build_use_case_draft(
                feature_intent=feature_intent,
                use_case_id=f"{uc_prefix}-{sequence:02d}",
                title=f"{primary_actor} tiếp nhận và khởi tạo xử lý {feature_label}",
                objective=(
                    f"Bảo đảm {primary_actor.lower()} có thể tiếp nhận đúng đầu vào, "
                    f"kiểm tra thông tin ban đầu, và khởi tạo luồng xử lý cho {feature_label.lower()}."
                ),
                primary_actor=primary_actor,
                supporting_actors=supporting_actors,
                preconditions=generic_preconditions,
                happy_path_summary=build_intake_happy_path(
                    primary_actor, feature_intent, supporting_actors
                ),
                key_exceptions=build_intake_exceptions(feature_intent),
                success_outcome=(
                    f"Yêu cầu hoặc tín hiệu đầu vào cho {feature_label.lower()} đã được ghi nhận đầy đủ "
                    "và sẵn sàng chuyển sang bước xử lý nghiệp vụ tiếp theo."
                ),
            )
        )
        sequence += 1

    execution_preconditions = generic_preconditions[:]
    if use_cases:
        execution_preconditions.append(
            "Use case khởi tạo/tiếp nhận đã hoàn tất và dữ liệu đầu vào ở trạng thái dùng được."
        )
    use_cases.append(
        build_use_case_draft(
            feature_intent=feature_intent,
            use_case_id=f"{uc_prefix}-{sequence:02d}",
            title=f"{primary_actor} thực hiện xử lý chính cho {feature_label}",
            objective=(
                f"Thực thi nghiệp vụ cốt lõi của {feature_label.lower()}, cập nhật kết quả xử lý, "
                "và tạo đầu ra phù hợp cho các actor liên quan."
            ),
            primary_actor=primary_actor,
            supporting_actors=supporting_actors,
            preconditions=execution_preconditions,
            happy_path_summary=build_execution_happy_path(
                primary_actor, feature_intent, supporting_actors
            ),
            key_exceptions=build_execution_exceptions(feature_intent),
            success_outcome=(
                feature_intent.success_outcome
                or f"Nghiệp vụ {feature_label.lower()} được hoàn tất và các đầu ra chính đã được cập nhật."
            ),
        )
    )
    sequence += 1

    if should_create_coordination_use_case(project_spec, feature_intent, supporting_actors):
        use_cases.append(
            build_use_case_draft(
                feature_intent=feature_intent,
                use_case_id=f"{uc_prefix}-{sequence:02d}",
                title=f"{primary_actor} phối hợp actor và hệ thống để hoàn tất {feature_label}",
                objective=(
                    f"Bảo đảm các actor hỗ trợ, hệ thống liên quan, và đầu ra phụ của {feature_label.lower()} "
                    "được phối hợp nhất quán sau bước xử lý chính."
                ),
                primary_actor=primary_actor,
                supporting_actors=supporting_actors,
                preconditions=generic_preconditions
                + ["Bước xử lý chính đã tạo ra trạng thái hoặc dữ liệu sẵn sàng cho phối hợp tiếp theo."],
                happy_path_summary=build_coordination_happy_path(
                    primary_actor, feature_intent, supporting_actors
                ),
                key_exceptions=build_coordination_exceptions(feature_intent),
                success_outcome=build_coordination_success_outcome(feature_intent),
            )
        )
        sequence += 1

    if should_create_exception_use_case(project_spec, feature_intent):
        use_cases.append(
            build_use_case_draft(
                feature_intent=feature_intent,
                use_case_id=f"{uc_prefix}-{sequence:02d}",
                title=f"{primary_actor} xử lý ngoại lệ, từ chối, hoặc điều chỉnh cho {feature_label}",
                objective=(
                    f"Bảo đảm {feature_label.lower()} có đường xử lý rõ ràng khi đầu vào không hợp lệ, "
                    "không đủ điều kiện, hoặc cần hủy/điều chỉnh giữa chừng."
                ),
                primary_actor=primary_actor,
                supporting_actors=supporting_actors,
                preconditions=generic_preconditions,
                happy_path_summary=build_exception_happy_path(
                    primary_actor, feature_intent, supporting_actors
                ),
                key_exceptions=build_exception_exceptions(project_spec, feature_intent),
                success_outcome=(
                    "Các trường hợp ngoại lệ đã được khép lại với trạng thái cuối, "
                    "lý do xử lý, và thông tin thông báo phù hợp."
                ),
            )
        )

    return use_cases


def build_use_case_draft(
    *,
    feature_intent: FeatureIntent,
    **kwargs: object,
) -> UseCaseDraft:
    primary_actor = str(kwargs["primary_actor"])
    supporting_actors = list(kwargs["supporting_actors"])  # type: ignore[arg-type]
    happy_path = list(kwargs["happy_path_summary"])  # type: ignore[arg-type]
    exceptions = list(kwargs["key_exceptions"])  # type: ignore[arg-type]
    use_case_id = str(kwargs["use_case_id"])
    main_flow_steps = build_structured_main_flow(
        use_case_id,
        happy_path,
        primary_actor,
        supporting_actors,
        feature_intent,
    )
    return UseCaseDraft(
        **kwargs,
        main_flow_steps=main_flow_steps,
        alternate_flows=build_structured_alternate_flows(
            use_case_id,
            exceptions,
            main_flow_steps,
            primary_actor,
        ),
    )


def build_structured_main_flow(
    use_case_id: str,
    actions: list[str],
    primary_actor: str,
    supporting_actors: list[str],
    feature_intent: FeatureIntent,
) -> list[UseCaseFlowStep]:
    steps: list[UseCaseFlowStep] = []
    for index, action in enumerate(actions, start=1):
        steps.append(
            UseCaseFlowStep(
                step_id=f"{use_case_id}-S{index:02d}",
                actor_ref=resolve_step_actor(action, primary_actor, supporting_actors),
                action=action,
                input_or_trigger=feature_intent.trigger if index == 1 else None,
                expected_result=build_expected_result(action, feature_intent, index, len(actions)),
            )
        )
    return steps


def build_structured_alternate_flows(
    use_case_id: str,
    exceptions: list[str],
    main_flow_steps: list[UseCaseFlowStep],
    primary_actor: str,
) -> list[UseCaseAlternateFlow]:
    if not main_flow_steps:
        return []
    source_index = max(0, len(main_flow_steps) - 2)
    source_step = main_flow_steps[source_index]
    rejoin_step = (
        main_flow_steps[source_index + 1]
        if source_index + 1 < len(main_flow_steps)
        else None
    )
    flows: list[UseCaseAlternateFlow] = []
    for index, exception in enumerate(exceptions, start=1):
        flow_id = f"{use_case_id}-AF{index:02d}"
        flows.append(
            UseCaseAlternateFlow(
                flow_id=flow_id,
                source_step_id=source_step.step_id,
                condition=exception,
                steps=[
                    UseCaseFlowStep(
                        step_id=f"{flow_id}-S01",
                        actor_ref=primary_actor,
                        action=f"Ghi nhận và xử lý ngoại lệ: {exception}",
                        expected_result="Ngoại lệ được xử lý với trạng thái và lý do rõ ràng.",
                    )
                ],
                rejoin_step_id=rejoin_step.step_id if rejoin_step else None,
                terminal_outcome=None if rejoin_step else exception,
            )
        )
    return flows


def resolve_step_actor(
    action: str,
    primary_actor: str,
    supporting_actors: list[str],
) -> str:
    lowered = action.lower()
    for actor in supporting_actors:
        if actor.lower() in lowered:
            return actor
    if "hệ thống" in lowered:
        for actor in supporting_actors:
            if any(token in actor.lower() for token in ("system", "portal", "app", "hệ thống")):
                return actor
    return primary_actor


def build_expected_result(
    action: str,
    feature_intent: FeatureIntent,
    index: int,
    total: int,
) -> str:
    if index == total and feature_intent.success_outcome:
        return feature_intent.success_outcome
    return f"Hoàn tất bước: {action.rstrip('.').lower()}."


def build_use_case_prefix(project_name: str, feature_name: str) -> str:
    project_slug = slugify(project_name)[:6] or "proj"
    feature_slug = slugify(feature_name)[:8] or "feature"
    return f"UC-{project_slug.upper()}-{feature_slug.upper()}"


def build_generic_preconditions(
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
) -> list[str]:
    conditions = [
        f"Đã có bối cảnh dự án '{project_spec.project_name}' và phạm vi nghiệp vụ liên quan được xác định.",
        f"Đã chốt intent chức năng '{feature_intent.feature_name}' ở mức đủ để bắt đầu phân rã use case.",
    ]
    if feature_intent.trigger:
        conditions.append(f"Đầu vào hoặc trigger chính đã xuất hiện: {feature_intent.trigger}.")
    if feature_intent.inputs:
        conditions.append(
            "Các input chính đã sẵn sàng: " + ", ".join(feature_intent.inputs) + "."
        )
    if feature_intent.constraints:
        conditions.append(
            "Các ràng buộc chính đã được biết: " + "; ".join(feature_intent.constraints[:3]) + "."
        )
    return conditions


def build_intake_happy_path(
    primary_actor: str,
    feature_intent: FeatureIntent,
    supporting_actors: list[str],
) -> list[str]:
    feature_label = feature_intent.feature_name.lower()
    technical_actor = select_technical_actor(supporting_actors)
    handoff_actor = technical_actor or select_supporting_actor(supporting_actors)
    return [
        f"{primary_actor} tiếp nhận đầu vào hoặc yêu cầu liên quan đến {feature_label}.",
        f"{primary_actor} kiểm tra tính đầy đủ và ngữ cảnh ban đầu của thông tin đầu vào.",
        f"{primary_actor} ghi nhận hoặc khởi tạo hồ sơ xử lý cho {feature_label}.",
        (
            f"{handoff_actor} được kích hoạt để chuẩn bị cho bước xử lý chính."
            if handoff_actor
            else "Hệ thống hoặc actor hỗ trợ được kích hoạt để chuẩn bị cho bước xử lý chính."
        ),
    ]


def build_execution_happy_path(
    primary_actor: str,
    feature_intent: FeatureIntent,
    supporting_actors: list[str],
) -> list[str]:
    feature_label = feature_intent.feature_name.lower()
    outputs = ", ".join(feature_intent.outputs) if feature_intent.outputs else "kết quả xử lý"
    technical_actor = select_technical_actor(supporting_actors)
    return [
        f"{primary_actor} mở thông tin chi tiết cần xử lý cho {feature_label}.",
        (
            f"{technical_actor} xử lý tín hiệu, dữ liệu, hoặc suy luận kỹ thuật cần thiết cho {feature_label}."
            if technical_actor
            else f"{primary_actor} thực hiện các hành động nghiệp vụ chính theo intent đã mô tả."
        ),
        f"{primary_actor} xác nhận kết quả xử lý và cập nhật {outputs}.",
        f"Các actor liên quan nhận được trạng thái hoặc kết quả cuối của {feature_label}.",
    ]


def build_coordination_happy_path(
    primary_actor: str,
    feature_intent: FeatureIntent,
    supporting_actors: list[str],
) -> list[str]:
    feature_label = feature_intent.feature_name.lower()
    systems = ", ".join(feature_intent.systems_involved) if feature_intent.systems_involved else "các hệ thống liên quan"
    outputs = ", ".join(feature_intent.outputs) if feature_intent.outputs else "đầu ra liên quan"
    coordination_actor = select_supporting_actor(supporting_actors)
    return [
        f"{primary_actor} phối hợp với các actor hỗ trợ để hoàn tất các bước sau xử lý chính của {feature_label}.",
        (
            f"{coordination_actor} nhận dữ liệu cập nhật từ luồng xử lý và đồng bộ với {systems}."
            if coordination_actor
            else f"Hệ thống hoặc module liên quan ({systems}) nhận dữ liệu cập nhật từ luồng xử lý."
        ),
        f"Các đầu ra như {outputs} được đồng bộ hoặc gửi tới đúng bên liên quan.",
        "Trạng thái cuối được ghi nhận nhất quán cho toàn bộ các bên tham gia.",
    ]


def build_exception_happy_path(
    primary_actor: str,
    feature_intent: FeatureIntent,
    supporting_actors: list[str],
) -> list[str]:
    feature_label = feature_intent.feature_name.lower()
    technical_actor = select_technical_actor(supporting_actors)
    return [
        f"{primary_actor} phát hiện trường hợp không đủ điều kiện, lỗi dữ liệu, hoặc nhu cầu hủy/điều chỉnh của {feature_label}.",
        f"{primary_actor} xác nhận lý do ngoại lệ và chọn hướng xử lý phù hợp.",
        (
            f"{technical_actor} cập nhật trạng thái ngoại lệ, lưu lịch sử, và trả tín hiệu kỹ thuật cần thiết."
            if technical_actor
            else "Hệ thống cập nhật trạng thái ngoại lệ, lưu lịch sử, và thông báo cho các bên liên quan nếu cần."
        ),
        "Quy trình được khép lại ở trạng thái rõ ràng hoặc trả về bước phù hợp để xử lý lại.",
    ]


def build_intake_exceptions(feature_intent: FeatureIntent) -> list[str]:
    exceptions = [
        "Thông tin đầu vào thiếu hoặc không đủ dữ kiện để khởi tạo xử lý.",
        "Actor thực hiện không có quyền hoặc không đúng vai trò cho bước tiếp nhận.",
    ]
    if feature_intent.constraints:
        exceptions.append("Có ràng buộc nghiệp vụ khiến yêu cầu không thể tiếp nhận ngay.")
    return exceptions


def build_execution_exceptions(feature_intent: FeatureIntent) -> list[str]:
    exceptions = [
        "Dữ liệu cần xử lý không còn hợp lệ tại thời điểm thực hiện.",
        "Có xung đột trạng thái hoặc điều kiện khiến thao tác chính không thể hoàn tất.",
    ]
    if feature_intent.outputs:
        exceptions.append("Đầu ra mong muốn không thể cập nhật đầy đủ cho toàn bộ hệ thống liên quan.")
    return exceptions


def build_coordination_exceptions(feature_intent: FeatureIntent) -> list[str]:
    exceptions = [
        "Một actor hoặc hệ thống phối hợp không phản hồi hoặc không sẵn sàng đúng thời điểm.",
        "Kết quả xử lý chính có nhưng không thể đồng bộ đầy đủ sang các đầu ra liên quan.",
    ]
    if feature_intent.systems_involved:
        exceptions.append(
            "Có ít nhất một hệ thống liên quan cần xử lý tay hoặc đối soát thêm sau bước đồng bộ."
        )
    return exceptions


def build_coordination_success_outcome(feature_intent: FeatureIntent) -> str:
    if feature_intent.outputs:
        return "Các đầu ra liên quan đã được phối hợp và cập nhật đầy đủ: " + ", ".join(
            feature_intent.outputs
        ) + "."
    return "Các actor và hệ thống liên quan đã nhận được trạng thái cuối nhất quán."


def build_exception_exceptions(
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
) -> list[str]:
    exceptions = [
        "Lý do từ chối hoặc hủy chưa đủ rõ để kết thúc quy trình.",
        "Một phần dữ liệu đã thay đổi trạng thái nên cần rollback hoặc xử lý tiếp nối.",
    ]
    if project_spec.business_rules:
        exceptions.append(
            "Ngoại lệ cần đối chiếu thêm với rule nghiệp vụ: "
            + "; ".join(project_spec.business_rules[:2])
            + "."
        )
    if feature_intent.assumptions:
        exceptions.append(
            "Một số giả định ban đầu không còn đúng khi phát sinh trường hợp ngoại lệ."
        )
    return exceptions


def should_create_exception_use_case(
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
) -> bool:
    corpus = " ".join(
        [
            project_spec.project_summary,
            project_spec.business_context or "",
            feature_intent.feature_summary,
            *feature_intent.constraints,
            *project_spec.business_rules,
        ]
    ).lower()
    exception_keywords = (
        "hủy",
        "tu choi",
        "từ chối",
        "ngoại lệ",
        "rollback",
        "điều chỉnh",
        "lỗi",
        "invalid",
        "cancel",
        "reject",
    )
    return bool(project_spec.business_rules or feature_intent.constraints) or any(
        keyword in corpus for keyword in exception_keywords
    )


def should_create_intake_use_case(
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
    supporting_actors: list[str],
) -> bool:
    corpus = " ".join(
        [
            feature_intent.feature_name,
            feature_intent.feature_summary,
            feature_intent.trigger or "",
        ]
    ).lower()
    intake_keywords = (
        "tiếp nhận",
        "đăng ký",
        "yêu cầu",
        "submit",
        "request",
        "khởi tạo",
        "mở hồ sơ",
    )
    return bool(
        feature_intent.trigger
        or feature_intent.inputs
        or len(project_spec.target_users) > 1
        or len(supporting_actors) > 0
        or any(keyword in corpus for keyword in intake_keywords)
    )


def should_create_coordination_use_case(
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
    supporting_actors: list[str],
) -> bool:
    corpus = " ".join(
        [
            project_spec.project_summary,
            project_spec.business_context or "",
            feature_intent.feature_summary,
            *feature_intent.outputs,
        ]
    ).lower()
    coordination_keywords = (
        "thông báo",
        "đồng bộ",
        "phê duyệt",
        "bàn giao",
        "cập nhật trạng thái",
        "lắp đặt",
        "giao nhận",
    )
    return bool(
        len(supporting_actors) >= 2
        or len(feature_intent.systems_involved) >= 2
        or len(feature_intent.outputs) >= 2
        or any(keyword in corpus for keyword in coordination_keywords)
    )


def unique_values(values: list[str], exclude: set[str] | None = None) -> list[str]:
    exclude = exclude or set()
    result: list[str] = []
    for value in values:
        normalized = value.strip()
        if not normalized or normalized in exclude or normalized in result:
            continue
        result.append(normalized)
    return result


def select_technical_actor(actors: list[str]) -> str | None:
    for actor in actors:
        if is_technical_actor(actor):
            return actor
    return None


def select_supporting_actor(actors: list[str]) -> str | None:
    return actors[0] if actors else None


def slugify(value: str) -> str:
    ascii_value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-")
    return ascii_value.lower()
