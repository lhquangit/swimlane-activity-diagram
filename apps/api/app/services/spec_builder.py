from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.spec import DiagramBRDSpec
from app.services.reader_text import normalize_inline_text


def build_deterministic_spec(
    payload: dict[str, Any],
    interpreted: dict[str, Any],
    warnings: list[dict[str, Any]],
    model_name: str,
) -> dict[str, Any]:
    lane_map = interpreted["lane_map"]
    main_flow_steps = []
    for index, node in enumerate(interpreted["main_flow_nodes"], start=1):
        actor_name = lane_map[node.lane_id].title if node.lane_id and node.lane_id in lane_map else None
        description = build_main_flow_description(node)
        main_flow_steps.append(
            {
                "step_id": f"S{index:02d}",
                "node_id": node.id,
                "actor_lane_id": node.lane_id,
                "actor_name": actor_name,
                "description": description,
            }
        )

    summary = build_process_overview(payload, interpreted, main_flow_steps)
    return {
        "metadata": {
            "diagram_name": payload["diagram_name"],
            "source_language": "vi",
            "generated_language": "vi",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator_model": model_name,
            "generator_version": "mock-deterministic-v1",
        },
        "summary": summary,
        "actors": [
            {
                "lane_id": lane["id"],
                "actor_name": lane["title"],
                "responsibilities": [],
            }
            for lane in payload["lanes"]
        ],
        "main_flow_steps": main_flow_steps,
        "branches": interpreted["branches"],
        "parallel_blocks": interpreted["parallel_blocks"],
        "handoffs": interpreted["handoffs"],
        "loops": interpreted["loops"],
        "annotations": interpreted["annotations"],
        "context_notes": interpreted["context_notes"],
        "assumptions": interpreted["assumptions"],
        "open_questions": interpreted["open_questions"],
        "warnings": warnings,
    }


def harmonize_generated_spec(
    generated_spec: DiagramBRDSpec,
    deterministic_spec: dict[str, Any],
) -> DiagramBRDSpec:
    merged = generated_spec.model_dump(mode="python")
    deterministic = dict(deterministic_spec)

    for field_name in (
        "actors",
        "main_flow_steps",
        "branches",
        "parallel_blocks",
        "handoffs",
        "loops",
        "annotations",
        "context_notes",
        "assumptions",
        "open_questions",
    ):
        merged[field_name] = deterministic[field_name]
    merged["warnings"] = deterministic["warnings"]
    merged["summary"] = deterministic["summary"]
    return DiagramBRDSpec.model_validate(merged)


def build_main_flow_description(node: Any) -> str:
    normalized_text = normalize_inline_text(node.text)
    if node.type == "decision":
        return f'Ra quyết định: {normalized_text or "Xác định hướng xử lý"}'
    if node.type == "end":
        return normalized_text or "Kết thúc quy trình"
    return normalized_text or "Thực hiện bước công việc"


def build_process_overview(
    payload: dict[str, Any],
    interpreted: dict[str, Any],
    main_flow_steps: list[dict[str, Any]],
) -> str:
    domain_subject = infer_process_subject(payload, interpreted, main_flow_steps)
    first_actor_name = next(
        (step["actor_name"] for step in main_flow_steps if step.get("actor_name")),
        None,
    )
    context_note_text = next(
        (note for note in interpreted.get("context_notes", []) if str(note).strip()),
        None,
    )
    trigger_actor_name = detect_trigger_actor_name(payload, context_note_text)
    process_sentences = [
        overview_intro_for_subject(domain_subject)
    ]
    if trigger_actor_name and context_note_text and first_actor_name:
        process_sentences.append(
            f"Quy trình được kích hoạt từ {trigger_actor_name}. "
            f'Bối cảnh đầu vào gồm: {summarize_context_note(context_note_text)}. '
            f"Sau đó {first_actor_name} tiếp nhận và điều phối xử lý ban đầu."
        )
    elif context_note_text and first_actor_name:
        process_sentences.append(
            f'Quy trình được khởi phát từ tín hiệu đầu vào đã mô tả trong phần Context: {summarize_context_note(context_note_text)}. '
            f"Sau đó {first_actor_name} tiếp nhận và điều phối xử lý ban đầu."
        )
    elif first_actor_name:
        process_sentences.append(
            f"Quy trình bắt đầu khi có tín hiệu hoặc yêu cầu đầu vào; sau đó {first_actor_name} tiếp nhận và điều phối xử lý ban đầu."
        )
    return " ".join(process_sentences)


def detect_trigger_actor_name(payload: dict[str, Any], context_note_text: str | None) -> str | None:
    if not context_note_text:
        return None
    lane_title_by_id = {lane["id"]: lane["title"] for lane in payload.get("lanes", [])}
    for node in payload.get("nodes", []):
        if node.get("type") != "note":
            continue
        if str(node.get("text") or "").strip() != context_note_text.strip():
            continue
        lane_id = node.get("lane_id")
        if lane_id and lane_id in lane_title_by_id:
            return lane_title_by_id[lane_id]
    return None


def summarize_context_note(context_note_text: str) -> str:
    first_line = next(
        (line.strip() for line in context_note_text.splitlines() if line.strip()),
        context_note_text.strip(),
    )
    return first_line.rstrip(":").rstrip(".")


def infer_process_subject(
    payload: dict[str, Any],
    interpreted: dict[str, Any],
    main_flow_steps: list[dict[str, Any]],
) -> str:
    corpus_parts = [payload.get("diagram_name", "")]
    corpus_parts.extend(interpreted.get("context_notes", []))
    corpus_parts.extend(step.get("description", "") for step in main_flow_steps)
    corpus = normalize_inline_text(" ".join(str(part) for part in corpus_parts)).lower()

    if contains_any_keyword(corpus, ("cháy", "khói", "báo cháy", "sensor báo khói")):
        return "fire_incident"
    if contains_any_keyword(corpus, ("bom", "vật nghi vấn", "đe dọa bom")):
        return "bomb_threat"
    return "generic_process"


def overview_intro_for_subject(subject: str) -> str:
    if subject == "fire_incident":
        return "Quy trình mô tả cách các actor phối hợp tiếp nhận tín hiệu, xác minh hiện trường, và xử lý sự cố cháy theo diagram hiện tại."
    if subject == "bomb_threat":
        return "Quy trình mô tả cách các actor phối hợp tiếp nhận, đánh giá, xác minh, và xử lý thông tin đe dọa bom theo diagram hiện tại."
    return "Quy trình mô tả cách các actor phối hợp tiếp nhận, xác minh, và xử lý sự kiện theo diagram hiện tại."


def contains_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)
