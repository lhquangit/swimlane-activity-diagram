from __future__ import annotations

from app.schemas.spec import BranchOutcome, DiagramBRDSpec, MainFlowStep
from app.services.reader_text import normalize_inline_text
from app.services.reader_text import split_structured_note


def render_brd_markdown(spec: DiagramBRDSpec, template: str = "default") -> str:
    lines: list[str] = []
    lines.append(f"# {spec.metadata.diagram_name}")
    if spec.metadata.project_name or spec.metadata.feature_name:
        project_label = spec.metadata.project_name or "Dự án hiện tại"
        feature_label = spec.metadata.feature_name or "Module hiện tại"
        lines.append("")
        lines.append(f"Dự án {project_label} | Module {feature_label}")
    lines.append("")
    lines.append("## 1. Mục đích tài liệu")
    lines.append(spec.summary or "Chưa có tóm tắt.")
    lines.append(build_business_objective(spec))
    lines.append("")
    lines.append("## 2. Phạm vi nghiệp vụ")
    lines.extend(render_scope_groups(spec))
    lines.append("")
    lines.append("## 3. Actor")
    lines.extend(render_actor_table(spec))
    lines.append("")
    lines.append("## 4. Danh sách user case trong tài liệu")
    lines.extend(render_use_case_catalog(spec))
    lines.append("")
    lines.append("## 5. Trạng thái nghiệp vụ")
    lines.extend(render_state_catalogs(spec))

    formal_use_cases = spec.formal_use_cases or [build_fallback_formal_use_case(spec)]
    section_number = 6
    for use_case in formal_use_cases:
        lines.append("")
        lines.append(f"## {section_number}. {use_case.code}: {use_case.title}")
        lines.append("")
        lines.append(f"### {section_number}.1. Mục tiêu")
        lines.append(use_case.objective)
        lines.append("")
        lines.append(f"### {section_number}.2. Tiền điều kiện")
        lines.extend(render_name_detail_table(["Điều kiện", "Mô tả"], use_case.preconditions))
        lines.append("")
        lines.append(f"### {section_number}.3. Luồng chính")
        if use_case.figure_caption:
            lines.append(f"![Hình 1](placeholder://{use_case.code.lower()}-main-flow)")
            lines.append(use_case.figure_caption if use_case.figure_caption.startswith("Hình ") else f"Hình 1: {use_case.figure_caption}")
            lines.append("")
        lines.extend(render_flow_table(use_case.main_flow_rows))
        if spec.branches:
            lines.append("")
            lines.append("#### Decision logic")
            lines.extend(render_decision_list(spec))
        if spec.parallel_blocks:
            lines.append("")
            lines.append("#### Hoạt động song song")
            for block in spec.parallel_blocks:
                lines.append(f"- {block.description}")
        if spec.handoffs:
            lines.append("")
            lines.append("#### Handoffs")
            for handoff in spec.handoffs:
                description = normalize_inline_text(handoff.reason) or "Chuyển giao công việc giữa các actor."
                lines.append(f"- {handoff.from_actor} -> {handoff.to_actor}: {description}")
        lines.append("")
        lines.append(f"### {section_number}.4. Luồng trạng thái")
        if use_case.state_flow:
            lines.extend(f"- {normalize_inline_text(item)}" for item in use_case.state_flow)
        else:
            lines.append("- Không có luồng trạng thái nổi bật.")
        lines.append("")
        lines.append(f"### {section_number}.5. Luồng ngoại lệ")
        lines.extend(render_name_detail_table(["Tình huống", "Cách xử lý"], use_case.exception_rows))
        if use_case.outcome_rows:
            lines.append("")
            lines.append(f"### {section_number}.6. Kết quả / trạng thái sau xử lý")
            lines.extend(render_name_detail_table(["Đối tượng", "Trạng thái sau xử lý"], use_case.outcome_rows))
        section_number += 1

    lines.append("")
    lines.append(f"## {section_number}. Context / assumptions / open questions")
    if spec.annotations:
        for annotation in spec.annotations:
            lines.append(f"- Annotation: {normalize_inline_text(annotation)}")
    if spec.context_notes:
        for context_note in spec.context_notes:
            lines.extend(render_context_note(context_note))
    for assumption in spec.assumptions:
        lines.append(f"- Assumption: {normalize_inline_text(assumption)}")
    for question in spec.open_questions:
        lines.append(f"- Open question: {normalize_inline_text(question)}")
    if not has_assumption_section_content(spec):
        lines.append("- Không có giả định hoặc câu hỏi mở nổi bật.")

    if template == "full":
        lines.append("")
        lines.extend(render_traceability_appendix(spec))

    return "\n".join(lines)


def render_scope(spec: DiagramBRDSpec) -> list[str]:
    lines: list[str] = []
    context_heading = first_context_heading(spec)
    first_step = spec.main_flow_steps[0] if spec.main_flow_steps else None
    last_step = spec.main_flow_steps[-1] if spec.main_flow_steps else None

    if context_heading:
        lines.append(f"- Trigger / đầu vào: {context_heading}.")
    elif spec.summary:
        lines.append("- Trigger / đầu vào: Quy trình được khởi phát khi xuất hiện tín hiệu hoặc yêu cầu cần xử lý.")

    if first_step:
        lines.append(f"- Điểm bắt đầu xử lý: {render_scope_step_reference(first_step)}.")
    if last_step:
        lines.append(f"- Điểm kết thúc chính: {render_scope_step_reference(last_step)}.")

    lines.append(f"- Phạm vi bao phủ: {build_scope_coverage(spec)}")
    lines.append(
        f"- Thông tin tổng quan: {len(spec.actors)} actor tham gia và {len(spec.main_flow_steps)} bước chính trong luồng xử lý."
    )
    return lines


def render_scope_groups(spec: DiagramBRDSpec) -> list[str]:
    rows = spec.scope_groups or render_scope_as_groups(spec)
    return render_name_detail_table(["Nhóm nghiệp vụ", "Nội dung"], rows, key_name="group_name")


def render_scope_as_groups(spec: DiagramBRDSpec) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in render_scope(spec):
        if ":" in line:
            name, detail = line.lstrip("- ").split(":", 1)
            rows.append({"group_name": normalize_inline_text(name), "detail": normalize_inline_text(detail)})
    if not rows:
        rows.append({"group_name": "Phạm vi nghiệp vụ", "detail": "Tài liệu mô tả quy trình xử lý theo diagram hiện tại."})
    return rows


def render_actor_table(spec: DiagramBRDSpec) -> list[str]:
    if not spec.actors:
        return render_name_detail_table(
            ["Actor", "Vai trò"],
            [{"name": "Chưa xác định", "detail": "Chưa xác định actor trong diagram."}],
            key_name="name",
        )

    rows = []
    for actor in spec.actors:
        if actor.responsibilities:
            detail = " ".join(normalize_inline_text(item) for item in actor.responsibilities if normalize_inline_text(item))
        else:
            detail = "Actor tham gia vào quy trình theo diagram hiện tại."
        rows.append({"name": actor.actor_name, "detail": detail})
    return render_name_detail_table(["Actor", "Vai trò"], rows, key_name="name")


def render_use_case_catalog(spec: DiagramBRDSpec) -> list[str]:
    rows = spec.use_case_catalog or [
        {
            "code": spec.metadata.source_use_case_key or "UC-01",
            "title": spec.metadata.source_use_case_title or spec.metadata.diagram_name,
            "objective": build_business_objective(spec),
        }
    ]
    return render_markdown_table(
        ["Mã UC", "Tên user case", "Mục tiêu"],
        [
            [get_row_value(row, "code"), get_row_value(row, "title"), get_row_value(row, "objective")]
            for row in rows
        ],
    )


def render_state_catalogs(spec: DiagramBRDSpec) -> list[str]:
    groups = spec.state_catalogs
    if not groups:
        return ["- Không có catalog trạng thái nghiệp vụ riêng cho tài liệu này."]

    lines: list[str] = []
    for group in groups:
        lines.append(f"### {group.title}")
        lines.extend(
            render_markdown_table(
                ["Trạng thái", "Ý nghĩa"],
                [[entry.state, entry.meaning] for entry in group.entries],
            )
        )
        lines.append("")
    if lines and not lines[-1]:
        lines.pop()
    return lines


def render_flow_table(rows: list) -> list[str]:
    if not rows:
        return ["- Chưa xác định được luồng chính."]
    return render_markdown_table(
        ["Bước", "Actor", "Hành động", "Kết quả / trạng thái"],
        [
            [
                get_row_value(row, "step"),
                get_row_value(row, "actor"),
                get_row_value(row, "action"),
                get_row_value(row, "outcome"),
            ]
            for row in rows
        ],
    )


def render_decision_list(spec: DiagramBRDSpec) -> list[str]:
    if not spec.branches:
        return ["- Không phát sinh nhánh quyết định đáng chú ý."]
    lines: list[str] = []
    for branch in spec.branches:
        actor_prefix = f"[{branch.decision_actor_name}] " if branch.decision_actor_name else ""
        lines.append(f"- {actor_prefix}{normalize_inline_text(branch.decision_text)}")
        for outcome in branch.outcomes:
            lines.append(f"  - {branch_outcome_prefix(outcome)}{branch_outcome_summary(outcome)}")
    return lines


def render_name_detail_table(
    headers: list[str],
    rows: list,
    key_name: str = "name",
) -> list[str]:
    if not rows:
        rows = [{key_name: "Chưa xác định", "detail": "Không có dữ liệu để hiển thị."}]
    return render_markdown_table(
        headers,
        [[get_row_value(row, key_name), get_row_value(row, "detail")] for row in rows],
    )


def render_markdown_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    lines = [
        f"| {' | '.join(headers)} |",
        f"| {' | '.join(':----' for _ in headers)} |",
    ]
    for row in rows:
        normalized_row = [normalize_inline_text(str(cell)) or "-" for cell in row]
        lines.append(f"| {' | '.join(normalized_row)} |")
    return lines


def get_row_value(row, field: str) -> str:
    if isinstance(row, dict):
        return str(row.get(field, ""))
    return str(getattr(row, field, ""))


def build_fallback_formal_use_case(spec: DiagramBRDSpec):
    use_case_code = spec.metadata.source_use_case_key or "UC-01"
    use_case_title = spec.metadata.source_use_case_title or spec.metadata.diagram_name
    preconditions = [
        {"name": "Đầu vào khả dụng", "detail": render_scope(spec)[0].lstrip("- ") if render_scope(spec) else "Quy trình có tín hiệu đầu vào."},
    ]
    rows = []
    for index, step in enumerate(spec.main_flow_steps, start=1):
        rows.append(
            {
                "step": str(index),
                "actor": step.actor_name or "Hệ thống",
                "action": normalize_inline_text(step.business_action or step.step_title or step.description),
                "outcome": normalize_inline_text(step.expected_result or step.step_purpose or "Bước xử lý được hoàn tất."),
            }
        )
    exception_rows = [{"name": "Warning", "detail": normalize_inline_text(item.message)} for item in spec.warnings]
    return type(
        "FallbackFormalUseCase",
        (),
        {
            "code": use_case_code,
            "title": use_case_title,
            "objective": build_business_objective(spec),
            "preconditions": preconditions,
            "main_flow_rows": rows,
            "state_flow": [build_scope_coverage(spec)] if spec.main_flow_steps else [],
            "exception_rows": exception_rows,
            "outcome_rows": [{"name": "Kết quả kỳ vọng", "detail": normalize_inline_text(spec.main_flow_steps[-1].expected_result or spec.main_flow_steps[-1].step_title or spec.summary)}] if spec.main_flow_steps else [],
            "figure_caption": f"Luồng chính xử lý cho {use_case_title}.",
        },
    )()


def render_scope_step_reference(step: MainFlowStep) -> str:
    actor_prefix = f"[{step.actor_name}] " if step.actor_name else ""
    return f"{actor_prefix}{normalize_inline_text(step.step_title or step.description)}"


def build_scope_coverage(spec: DiagramBRDSpec) -> str:
    if not spec.main_flow_steps:
        return "Chưa xác định đủ bước chính để mô tả phạm vi quy trình."

    first_step = spec.main_flow_steps[0]
    last_step = spec.main_flow_steps[-1]
    branch_count = len(spec.branches)

    coverage = (
        f'Quy trình bao phủ từ bước "{normalize_inline_text(first_step.step_title or first_step.description)}" '
        f'đến bước "{normalize_inline_text(last_step.step_title or last_step.description)}"'
    )
    if branch_count:
        coverage += f", với {branch_count} điểm quyết định điều hướng nhánh xử lý."
    else:
        coverage += "."
    return coverage


def first_context_heading(spec: DiagramBRDSpec) -> str | None:
    if not spec.context_notes:
        return None
    heading, _ = split_structured_note(spec.context_notes[0])
    normalized_heading = normalize_inline_text(heading)
    return normalized_heading.rstrip(".")


def format_step_heading(step: MainFlowStep) -> str:
    actor_prefix = f"[{step.actor_name}] " if step.actor_name else ""
    step_title = normalize_inline_text(step.step_title or step.description) or "Thực hiện bước công việc"
    return f"{actor_prefix}{step_title}"


def branch_outcome_prefix(outcome: BranchOutcome) -> str:
    label = outcome.label or "Nhánh chưa gắn nhãn"
    return f"{label}: "


def branch_outcome_summary(outcome: BranchOutcome) -> str:
    summary = format_branch_path(outcome.path_summary, outcome.target_node_text)
    if outcome.continues_main_flow:
        return f"Tiếp tục: {summary}."
    if outcome.rejoin_node_text:
        return f"{summary}; sau đó nhập lại luồng chính tại {outcome.rejoin_node_text}."
    return summary


def has_assumption_section_content(spec: DiagramBRDSpec) -> bool:
    return any((spec.annotations, spec.context_notes, spec.assumptions, spec.open_questions))


def format_branch_path(path_summary: list[str], fallback: str | None) -> str:
    steps = [normalize_inline_text(step) for step in path_summary if normalize_inline_text(step)]
    if not steps:
        return normalize_inline_text(fallback) or "Chưa xác định bước tiếp theo"
    if len(steps) == 1:
        return steps[0]
    if len(steps) == 2:
        return f"Thực hiện lần lượt {steps[0]}, rồi {steps[1]}"
    head = ", ".join(steps[:-1])
    return f"Thực hiện lần lượt {head}, rồi {steps[-1]}"


def render_context_note(context_note: str) -> list[str]:
    heading, bullet_items = split_structured_note(context_note)
    if bullet_items:
        lines = [f"- Context: {heading}."]
        lines.extend(f"  - {item}" for item in bullet_items)
        return lines
    normalized_context = normalize_inline_text(context_note)
    return [f"- Context: {normalized_context}"]


def build_business_objective(spec: DiagramBRDSpec) -> str:
    corpus = build_reader_facing_corpus(spec)
    if contains_any_keyword(corpus, ("cháy", "khói", "báo cháy", "sensor báo khói")):
        return (
            "Bảo đảm tín hiệu nghi ngờ cháy được tiếp nhận kịp thời, xác minh nhanh tại hiện trường, "
            "điều phối xử lý phù hợp, và khép quy trình an toàn theo kết quả xác minh."
        )
    if contains_any_keyword(corpus, ("bom", "vật nghi vấn", "đe dọa bom")):
        return (
            "Bảo đảm thông tin đe dọa bom được tiếp nhận, đánh giá, xác minh, "
            "và điều phối lực lượng xử lý theo mức độ nghi vấn."
        )
    return (
        "Bảo đảm sự kiện hoặc yêu cầu đầu vào được tiếp nhận đầy đủ, xác minh nhất quán, "
        "điều phối xử lý đúng actor, và khép quy trình theo kết quả thực tế."
    )


def build_reader_facing_corpus(spec: DiagramBRDSpec) -> str:
    parts: list[str] = [spec.summary]
    for step in spec.main_flow_steps:
        parts.extend(
            filter(
                None,
                (
                    step.description,
                    step.step_title,
                    step.step_purpose,
                    step.business_action,
                    step.expected_result,
                    step.input_or_trigger,
                ),
            )
        )
    parts.extend(branch.decision_text for branch in spec.branches)
    parts.extend(spec.context_notes)
    return normalize_inline_text(" ".join(part for part in parts if part)).lower()


def contains_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def render_traceability_appendix(spec: DiagramBRDSpec) -> list[str]:
    lines = ["## Appendix A. Traceability (debug)"]
    lines.append("")
    lines.append("### Main workflow trace")
    if spec.main_flow_steps:
        for step in spec.main_flow_steps:
            lines.append(f"- {step.step_id} -> {step.node_id}")
    else:
        lines.append("- Không có main workflow trace.")
    lines.append("")
    lines.append("### Decision trace")
    if spec.branches:
        for branch in spec.branches:
            lines.append(f"- {branch.decision_text} -> {branch.decision_node_id}")
            for outcome in branch.outcomes:
                label = outcome.label or "unlabeled"
                lines.append(f"  - {label} -> {outcome.target_node_id}")
    else:
        lines.append("- Không có decision trace.")
    lines.append("")
    lines.append("### Parallel trace")
    if spec.parallel_blocks:
        for block in spec.parallel_blocks:
            lines.append(
                f"- fork {block.fork_node_id}"
                + (f" -> join {block.join_node_id}" if block.join_node_id else "")
            )
    else:
        lines.append("- Không có parallel trace.")
    lines.append("")
    lines.append("### Handoff trace")
    if spec.handoffs:
        for handoff in spec.handoffs:
            lines.append(
                f"- {handoff.from_actor} -> {handoff.to_actor}: "
                f"{handoff.source_node_id} -> {handoff.target_node_id}"
            )
    else:
        lines.append("- Không có handoff trace.")
    lines.append("")
    return lines
