from __future__ import annotations

from app.schemas.spec import BranchOutcome, DiagramBRDSpec
from app.services.reader_text import normalize_inline_text
from app.services.reader_text import split_structured_note


def render_brd_markdown(spec: DiagramBRDSpec, template: str = "default") -> str:
    lines: list[str] = []
    lines.append(f"# {spec.metadata.diagram_name}")
    lines.append("")
    lines.append("## 1. Process overview")
    lines.append(spec.summary or "Chưa có tóm tắt.")
    lines.append("")
    lines.append("## 2. Business objective")
    lines.append(build_business_objective(spec))
    lines.append("")
    lines.append("## 3. Scope")
    lines.append(f"- Số actor: {len(spec.actors)}")
    lines.append(f"- Số bước chính: {len(spec.main_flow_steps)}")
    lines.append("")
    lines.append("## 4. Actors")
    if spec.actors:
        for actor in spec.actors:
            lines.append(f"- {actor.actor_name}")
    else:
        lines.append("- Chưa xác định actor.")
    lines.append("")
    lines.append("## 5. Main workflow")
    if spec.main_flow_steps:
        for step in spec.main_flow_steps:
            actor_prefix = f"[{step.actor_name}] " if step.actor_name else ""
            lines.append(f"1. {actor_prefix}{normalize_inline_text(step.description)}")
    else:
        lines.append("- Chưa xác định được bước chính.")
    lines.append("")
    lines.append("## 6. Decision logic")
    if spec.branches:
        for branch in spec.branches:
            actor_prefix = f"[{branch.decision_actor_name}] " if branch.decision_actor_name else ""
            lines.append(f"- {actor_prefix}{normalize_inline_text(branch.decision_text)}")
            for outcome in branch.outcomes:
                lines.append(f"  - {branch_outcome_prefix(outcome)}{branch_outcome_summary(outcome)}")
    else:
        lines.append("- Không phát sinh nhánh quyết định đáng chú ý.")
    lines.append("")
    lines.append("## 7. Parallel activities")
    if spec.parallel_blocks:
        for block in spec.parallel_blocks:
            lines.append(f"- {block.description}")
    else:
        lines.append("- Không có hoạt động song song đáng kể.")
    lines.append("")
    lines.append("## 8. Handoffs")
    if spec.handoffs:
        for handoff in spec.handoffs:
            description = normalize_inline_text(handoff.reason) or "Chuyển giao công việc giữa các actor."
            lines.append(
                f'- {handoff.from_actor} -> {handoff.to_actor}: {description}'
            )
    else:
        lines.append("- Không phát sinh điểm bàn giao rõ ràng giữa các actor.")
    lines.append("")
    lines.append("## 9. Exceptions / warnings")
    emitted_warning = False
    if spec.loops:
        for loop in spec.loops:
            emitted_warning = True
            lines.append(f"- Loop: {loop.note}")
    for warning in spec.warnings:
        emitted_warning = True
        lines.append(f"- [{warning.severity}] {warning.message}")
    if not emitted_warning:
        lines.append("- Không có warning nổi bật.")
    lines.append("")
    lines.append("## 10. Context / assumptions / open questions")
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
    lines.append("")
    lines.extend(render_traceability_appendix(spec))
    return "\n".join(lines)


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
    parts.extend(step.description for step in spec.main_flow_steps)
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
            lines.append(f'- {branch.decision_text} -> {branch.decision_node_id}')
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
