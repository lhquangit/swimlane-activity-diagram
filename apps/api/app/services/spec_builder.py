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
    context_note_text = next(
        (note for note in interpreted.get("context_notes", []) if str(note).strip()),
        None,
    )
    trigger_actor_name = detect_trigger_actor_name(payload, context_note_text)

    basic_steps = []
    for index, node in enumerate(interpreted["main_flow_nodes"], start=1):
        actor_name = lane_map[node.lane_id].title if node.lane_id and node.lane_id in lane_map else None
        actor_lane_id = node.lane_id
        if not actor_name and node.type == "end" and basic_steps:
            actor_name = basic_steps[-1].get("actor_name")
            actor_lane_id = basic_steps[-1].get("actor_lane_id")
        step_title = build_main_flow_title(node)
        description = build_main_flow_description(node, step_title)
        basic_steps.append(
            {
                "step_id": f"S{index:02d}",
                "node_id": node.id,
                "actor_lane_id": actor_lane_id,
                "actor_name": actor_name,
                "step_title": step_title,
                "description": description,
            }
        )

    domain_subject = infer_process_subject(payload, interpreted, basic_steps)
    main_flow_steps = enrich_main_flow_steps(
        basic_steps=basic_steps,
        main_flow_nodes=interpreted["main_flow_nodes"],
        handoffs=interpreted.get("handoffs", []),
        context_note_text=context_note_text,
        trigger_actor_name=trigger_actor_name,
        domain_subject=domain_subject,
    )
    summary = build_process_overview(payload, interpreted, main_flow_steps)
    actor_items = build_actor_items(
        lanes=payload["lanes"],
        main_flow_steps=main_flow_steps,
        trigger_actor_name=trigger_actor_name,
        domain_subject=domain_subject,
    )

    return {
        "metadata": {
            "diagram_name": payload["diagram_name"],
            "project_name": payload.get("project_name"),
            "feature_name": payload.get("feature_name"),
            "source_use_case_key": payload.get("source_use_case_key"),
            "source_use_case_title": payload.get("source_use_case_title"),
            "source_language": "vi",
            "generated_language": "vi",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generator_model": model_name,
            "generator_version": "mock-deterministic-v1",
        },
        "summary": summary,
        "actors": actor_items,
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
        "scope_groups": build_scope_groups(
            main_flow_steps=main_flow_steps,
            branches=interpreted["branches"],
            handoffs=interpreted["handoffs"],
            warnings=warnings,
            loops=interpreted["loops"],
        ),
        "state_catalogs": build_state_catalogs(main_flow_steps, interpreted["branches"], warnings),
        "use_case_catalog": build_use_case_catalog(payload, summary),
        "formal_use_cases": build_formal_use_case_sections(
            payload=payload,
            main_flow_steps=main_flow_steps,
            branches=interpreted["branches"],
            warnings=warnings,
            loops=interpreted["loops"],
        ),
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
        "scope_groups",
        "state_catalogs",
        "use_case_catalog",
        "formal_use_cases",
    ):
        merged[field_name] = deterministic[field_name]
    merged["warnings"] = deterministic["warnings"]
    merged["summary"] = deterministic["summary"]
    merged_metadata = merged.get("metadata", {})
    deterministic_metadata = deterministic["metadata"]
    merged["metadata"] = {
        **merged_metadata,
        "project_name": deterministic_metadata.get("project_name"),
        "feature_name": deterministic_metadata.get("feature_name"),
        "source_use_case_key": deterministic_metadata.get("source_use_case_key"),
        "source_use_case_title": deterministic_metadata.get("source_use_case_title"),
    }
    return DiagramBRDSpec.model_validate(merged)


def build_main_flow_title(node: Any) -> str:
    normalized_text = normalize_inline_text(node.text)
    if node.type == "decision":
        return f'Ra quyết định: {normalized_text or "Xác định hướng xử lý"}'
    if node.type == "end":
        return normalized_text or "Kết thúc quy trình"
    return normalized_text or "Thực hiện bước công việc"


def build_main_flow_description(node: Any, step_title: str | None = None) -> str:
    return step_title or build_main_flow_title(node)


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
    process_sentences = [overview_intro_for_subject(domain_subject)]
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
    corpus_parts.extend(step.get("step_title", "") for step in main_flow_steps)
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


def enrich_main_flow_steps(
    basic_steps: list[dict[str, Any]],
    main_flow_nodes: list[Any],
    handoffs: list[dict[str, Any]],
    context_note_text: str | None,
    trigger_actor_name: str | None,
    domain_subject: str,
) -> list[dict[str, Any]]:
    handoff_by_target = {
        handoff.get("target_node_id"): handoff
        for handoff in handoffs
        if handoff.get("target_node_id")
    }
    enriched_steps: list[dict[str, Any]] = []

    for index, (step, node) in enumerate(zip(basic_steps, main_flow_nodes, strict=False)):
        previous_step = basic_steps[index - 1] if index > 0 else None
        next_step = basic_steps[index + 1] if index + 1 < len(basic_steps) else None
        handoff = handoff_by_target.get(step["node_id"])
        raw_title = normalize_inline_text(node.text)
        step_title = step["step_title"]

        enriched_step = {
            **step,
            "input_or_trigger": infer_step_input_or_trigger(
                index=index,
                previous_step=previous_step,
                handoff=handoff,
                context_note_text=context_note_text,
                trigger_actor_name=trigger_actor_name,
            ),
            "step_purpose": infer_step_purpose(
                node_type=node.type,
                title=raw_title or step_title,
                domain_subject=domain_subject,
            ),
            "business_action": infer_business_action(
                actor_name=step.get("actor_name"),
                node_type=node.type,
                title=raw_title or step_title,
                handoff=handoff,
            ),
            "expected_result": infer_expected_result(
                node_type=node.type,
                title=raw_title or step_title,
                next_step_title=next_step.get("step_title") if next_step else None,
                domain_subject=domain_subject,
            ),
        }
        enriched_steps.append(enriched_step)

    return enriched_steps


def infer_step_input_or_trigger(
    index: int,
    previous_step: dict[str, Any] | None,
    handoff: dict[str, Any] | None,
    context_note_text: str | None,
    trigger_actor_name: str | None,
) -> str | None:
    if index == 0:
        if context_note_text:
            context_summary = summarize_context_note(context_note_text)
            if trigger_actor_name:
                return f"Tín hiệu hoặc thông tin đầu vào được khởi phát từ {trigger_actor_name}: {context_summary}."
            return f"Tín hiệu hoặc thông tin đầu vào: {context_summary}."
        return "Có tín hiệu hoặc yêu cầu đầu vào cần được tiếp nhận và xử lý."

    if handoff:
        handoff_reason = normalize_inline_text(handoff.get("reason"))
        if handoff_reason:
            return handoff_reason
        from_actor = handoff.get("from_actor")
        if from_actor:
            return f"Sau khi {from_actor} hoàn tất bước trước và bàn giao xử lý."

    if previous_step and previous_step.get("step_title"):
        return f'Sau khi hoàn tất bước "{normalize_inline_text(previous_step["step_title"])}".'
    return None


def infer_step_purpose(node_type: str, title: str, domain_subject: str) -> str:
    normalized_title = normalize_inline_text(title)
    lowered = normalized_title.lower()

    if node_type == "decision":
        return "Xác định nhánh xử lý tiếp theo dựa trên thông tin đã được xác minh."
    if node_type == "end":
        return "Khép quy trình sau khi đã có kết quả xử lý hoặc kết luận xác minh."
    if contains_any_keyword(lowered, ("tiếp nhận", "nhận tín hiệu", "nhận thông tin", "ghi nhận cảnh báo")):
        return "Ghi nhận tín hiệu hoặc thông tin đầu vào để khởi động quy trình xử lý."
    if contains_any_keyword(lowered, ("mở nhật ký", "mở log", "mở biên bản")):
        return "Thiết lập đầu mối theo dõi để lưu lại các diễn biến xử lý tiếp theo."
    if contains_any_keyword(lowered, ("ghi thời điểm", "ghi lại", "cập nhật thông tin", "ghi nhận")):
        return "Lưu lại thông tin ban đầu phục vụ xác minh và điều phối."
    if contains_any_keyword(lowered, ("báo tín hiệu", "thông báo", "chuyển thông tin", "báo cáo")):
        return "Kích hoạt phối hợp giữa các actor liên quan để bước xử lý không bị chậm trễ."
    if contains_any_keyword(lowered, ("điều phối", "điều động", "phân công", "huy động")):
        return "Phân công nguồn lực phù hợp đến đúng điểm xử lý hoặc hiện trường nghi vấn."
    if contains_any_keyword(lowered, ("di chuyển", "tiếp cận hiện trường", "đến điểm", "kiểm tra hiện trường")):
        return "Đưa nhân sự đến hiện trường để kiểm tra trực tiếp tình trạng thực tế."
    if contains_any_keyword(lowered, ("xác nhận", "xác minh")):
        return "Ghi nhận kết quả xác minh để làm cơ sở cho bước xử lý tiếp theo."
    if contains_any_keyword(lowered, ("xử lý", "khống chế", "ứng phó")):
        return "Thực hiện biện pháp xử lý phù hợp với mức độ tình huống thực tế."
    if domain_subject == "fire_incident":
        return "Thực hiện một phần việc trong quy trình xử lý sự cố cháy."
    if domain_subject == "bomb_threat":
        return "Thực hiện một phần việc trong quy trình xử lý thông tin đe dọa bom."
    return "Thực hiện một phần việc trong quy trình nghiệp vụ hiện tại."


def infer_business_action(
    actor_name: str | None,
    node_type: str,
    title: str,
    handoff: dict[str, Any] | None,
) -> str:
    actor = actor_name or "Actor phụ trách"
    normalized_title = normalize_inline_text(title)
    lowered = normalized_title.lower()

    if node_type == "decision":
        question = normalized_title.removeprefix("Ra quyết định: ").strip()
        return f'{actor} đánh giá câu hỏi nghiệp vụ "{question}" để chọn nhánh xử lý tiếp theo.'
    if node_type == "end":
        return f"{actor} khép lại quy trình và ghi nhận trạng thái kết thúc."
    if contains_any_keyword(lowered, ("tiếp nhận", "nhận tín hiệu", "nhận thông tin")):
        return f"{actor} tiếp nhận tín hiệu hoặc tin báo ban đầu từ nguồn khởi phát liên quan."
    if contains_any_keyword(lowered, ("mở nhật ký", "mở log", "mở biên bản")):
        return f"{actor} tạo hoặc mở hồ sơ theo dõi để lưu lại diễn biến xử lý."
    if contains_any_keyword(lowered, ("ghi thời điểm", "ghi lại", "cập nhật thông tin", "ghi nhận")):
        return f"{actor} cập nhật các thông tin đầu vào quan trọng như thời điểm, nguồn tin, và vị trí sơ bộ."
    if contains_any_keyword(lowered, ("báo tín hiệu", "thông báo", "chuyển thông tin", "báo cáo")):
        return f"{actor} chuyển thông tin đến các actor chính để cùng phối hợp xử lý."
    if contains_any_keyword(lowered, ("điều phối", "điều động", "phân công", "huy động")):
        return f"{actor} điều phối nhân sự hoặc nguồn lực phù hợp đến điểm cần xử lý."
    if contains_any_keyword(lowered, ("di chuyển", "tiếp cận hiện trường", "đến điểm", "kiểm tra hiện trường")):
        handoff_prefix = ""
        if handoff and handoff.get("from_actor"):
            handoff_prefix = f"Sau khi tiếp nhận bàn giao từ {handoff['from_actor']}, "
        return f"{handoff_prefix}{actor} di chuyển đến hiện trường hoặc điểm nghi vấn để kiểm tra thực tế."
    if contains_any_keyword(lowered, ("xác nhận", "xác minh")):
        return f"{actor} xác nhận hoặc làm rõ trạng thái thực tế của tình huống đang được xử lý."
    if contains_any_keyword(lowered, ("xử lý", "khống chế", "ứng phó")):
        return f"{actor} thực hiện biện pháp xử lý ban đầu phù hợp với tình huống đã được xác minh."
    return f'{actor} thực hiện hoạt động "{normalized_title}" theo vai trò được giao.'


def infer_expected_result(
    node_type: str,
    title: str,
    next_step_title: str | None,
    domain_subject: str,
) -> str:
    normalized_title = normalize_inline_text(title)
    lowered = normalized_title.lower()

    if node_type == "decision":
        return "Đã xác định được nhánh xử lý tiếp theo cho quy trình."
    if node_type == "end":
        return "Quy trình được khép lại với trạng thái kết thúc rõ ràng."
    if contains_any_keyword(lowered, ("tiếp nhận", "nhận tín hiệu", "nhận thông tin")):
        return "Tín hiệu ban đầu đã được ghi nhận để tiếp tục xử lý."
    if contains_any_keyword(lowered, ("mở nhật ký", "mở log", "mở biên bản")):
        return "Đã có bản ghi theo dõi để cập nhật các diễn biến tiếp theo."
    if contains_any_keyword(lowered, ("ghi thời điểm", "ghi lại", "cập nhật thông tin", "ghi nhận")):
        return "Thông tin đầu vào ban đầu đã đủ để phục vụ bước điều phối hoặc xác minh."
    if contains_any_keyword(lowered, ("báo tín hiệu", "thông báo", "chuyển thông tin", "báo cáo")):
        return "Các actor liên quan đã nhận được thông tin cần thiết để tiếp tục phối hợp."
    if contains_any_keyword(lowered, ("điều phối", "điều động", "phân công", "huy động")):
        return "Nguồn lực phù hợp đã được phân công đến điểm xử lý."
    if contains_any_keyword(lowered, ("di chuyển", "tiếp cận hiện trường", "đến điểm", "kiểm tra hiện trường")):
        return "Hiện trường sẵn sàng cho bước xác minh trực tiếp."
    if contains_any_keyword(lowered, ("xác nhận", "xác minh")):
        return "Kết quả xác minh đã sẵn sàng để chuyển sang bước xử lý hoặc khép quy trình."
    if contains_any_keyword(lowered, ("xử lý", "khống chế", "ứng phó")):
        return "Tình huống đã được xử lý hoặc đưa về trạng thái kiểm soát ban đầu."
    if next_step_title:
        return f'Sẵn sàng chuyển sang bước "{normalize_inline_text(next_step_title)}".'
    if domain_subject == "fire_incident":
        return "Tiến độ xử lý sự cố cháy được cập nhật và sẵn sàng cho bước tiếp theo."
    if domain_subject == "bomb_threat":
        return "Tiến độ xử lý thông tin đe dọa bom được cập nhật và sẵn sàng cho bước tiếp theo."
    return "Bước công việc được hoàn tất và quy trình sẵn sàng chuyển tiếp."


def build_actor_items(
    lanes: list[dict[str, Any]],
    main_flow_steps: list[dict[str, Any]],
    trigger_actor_name: str | None,
    domain_subject: str,
) -> list[dict[str, Any]]:
    steps_by_lane: dict[str, list[dict[str, Any]]] = {}
    for step in main_flow_steps:
        lane_id = step.get("actor_lane_id")
        if not lane_id:
            continue
        steps_by_lane.setdefault(lane_id, []).append(step)

    actor_items = []
    for lane in lanes:
        actor_name = lane["title"]
        responsibilities = infer_actor_responsibilities(
            actor_name=actor_name,
            steps=steps_by_lane.get(lane["id"], []),
            is_trigger_actor=actor_name == trigger_actor_name,
            domain_subject=domain_subject,
        )
        actor_items.append(
            {
                "lane_id": lane["id"],
                "actor_name": actor_name,
                "responsibilities": responsibilities,
            }
        )
    return actor_items


def infer_actor_responsibilities(
    actor_name: str,
    steps: list[dict[str, Any]],
    is_trigger_actor: bool,
    domain_subject: str,
) -> list[str]:
    if not steps and not is_trigger_actor:
        return []

    corpus = normalize_inline_text(
        " ".join(
            str(
                " ".join(
                    filter(
                        None,
                        (
                            step.get("step_title"),
                            step.get("business_action"),
                        ),
                    )
                )
            )
            for step in steps
        )
    ).lower()

    responsibilities: list[str] = []
    if is_trigger_actor:
        responsibilities.append("Khởi phát tín hiệu hoặc cung cấp thông tin đầu vào ban đầu cho quy trình.")
    if contains_any_keyword(corpus, ("tiếp nhận", "mở nhật ký", "ghi thời điểm", "ghi lại", "ghi nhận")):
        responsibilities.append("Tiếp nhận, ghi nhận, và lưu vết thông tin ban đầu của quy trình.")
    if contains_any_keyword(corpus, ("báo tín hiệu", "thông báo", "điều phối", "điều động", "phân công", "bàn giao")):
        responsibilities.append("Điều phối hoặc chuyển giao xử lý cho đúng actor liên quan theo diễn biến thực tế.")
    if contains_any_keyword(corpus, ("xác minh", "xác nhận", "kiểm tra", "ra quyết định")):
        responsibilities.append("Kiểm tra, xác minh, và xác định hướng xử lý tiếp theo theo tình huống thực tế.")
    if contains_any_keyword(corpus, ("xử lý", "khống chế", "ứng phó")):
        responsibilities.append("Thực hiện hoặc theo dõi biện pháp xử lý phù hợp với tình huống đã được xác minh.")

    if not responsibilities and steps:
        if domain_subject == "fire_incident":
            responsibilities.append(f"Thực hiện các phần việc được giao trong quy trình xử lý sự cố cháy của {actor_name}.")
        elif domain_subject == "bomb_threat":
            responsibilities.append(f"Thực hiện các phần việc được giao trong quy trình xử lý thông tin đe dọa bom của {actor_name}.")
        else:
            responsibilities.append(f"Thực hiện các phần việc nghiệp vụ được giao trong quy trình của {actor_name}.")

    return dedupe_preserve_order(responsibilities)[:3]


def dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def contains_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def build_scope_groups(
    main_flow_steps: list[dict[str, Any]],
    branches: list[dict[str, Any]],
    handoffs: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    loops: list[dict[str, Any]],
) -> list[dict[str, str]]:
    groups: list[dict[str, str]] = []
    if main_flow_steps:
        first_step = main_flow_steps[0]
        last_step = main_flow_steps[-1]
        groups.append(
            {
                "group_name": "Luồng xử lý chính",
                "detail": (
                    f'Quy trình bao phủ từ bước "{first_step.get("step_title") or first_step.get("description")}" '
                    f'đến bước "{last_step.get("step_title") or last_step.get("description")}".'
                ),
            }
        )
    if branches:
        groups.append(
            {
                "group_name": "Điều hướng quyết định",
                "detail": f"Quy trình có {len(branches)} điểm quyết định điều hướng nhánh xử lý.",
            }
        )
    if handoffs:
        groups.append(
            {
                "group_name": "Bàn giao giữa actor",
                "detail": f"Có {len(handoffs)} điểm bàn giao công việc hoặc thông tin giữa các actor.",
            }
        )
    if loops or warnings:
        groups.append(
            {
                "group_name": "Ngoại lệ và cảnh báo",
                "detail": "Tài liệu giữ lại các loop/cảnh báo để reviewer kiểm tra trước khi downstream sử dụng.",
            }
        )
    if not groups:
        groups.append(
            {
                "group_name": "Phạm vi nghiệp vụ",
                "detail": "Tài liệu mô tả quy trình xử lý theo diagram hiện tại.",
            }
        )
    return groups


def build_state_catalogs(
    main_flow_steps: list[dict[str, Any]],
    branches: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    lifecycle_entries: list[dict[str, str]] = []
    if main_flow_steps:
        lifecycle_entries.append(
            {
                "state": "Khởi phát xử lý",
                "meaning": normalize_inline_text(
                    main_flow_steps[0].get("input_or_trigger")
                    or main_flow_steps[0].get("step_title")
                    or "Quy trình bắt đầu khi có tín hiệu đầu vào."
                ),
            }
        )
        lifecycle_entries.append(
            {
                "state": "Đang xử lý",
                "meaning": f"Các actor phối hợp thực hiện {len(main_flow_steps)} bước chính của quy trình.",
            }
        )
        lifecycle_entries.append(
            {
                "state": "Hoàn tất",
                "meaning": normalize_inline_text(
                    main_flow_steps[-1].get("expected_result")
                    or main_flow_steps[-1].get("step_title")
                    or "Quy trình được khép lại theo kết quả cuối."
                ),
            }
        )

    decision_entries = [
        {
            "state": normalize_inline_text(branch.get("decision_text") or "Nhánh quyết định"),
            "meaning": f"Có {len(branch.get('outcomes', []))} hướng xử lý được gắn với điểm quyết định này.",
        }
        for branch in branches
    ]
    if warnings:
        decision_entries.append(
            {
                "state": "Cảnh báo review",
                "meaning": f"Có {len(warnings)} warning cần được review cùng tài liệu.",
            }
        )

    groups: list[dict[str, Any]] = []
    if lifecycle_entries:
        groups.append({"title": "5.1. Trạng thái luồng xử lý", "entries": lifecycle_entries})
    if decision_entries:
        groups.append({"title": "5.2. Trạng thái quyết định / review", "entries": decision_entries})
    return groups


def build_use_case_catalog(payload: dict[str, Any], summary: str) -> list[dict[str, str]]:
    return [
        {
            "code": payload.get("source_use_case_key") or "UC-01",
            "title": payload.get("source_use_case_title") or payload.get("diagram_name") or "Use case hiện tại",
            "objective": normalize_inline_text(summary) or "Mô tả mục tiêu xử lý chính của quy trình.",
        }
    ]


def build_formal_use_case_sections(
    payload: dict[str, Any],
    main_flow_steps: list[dict[str, Any]],
    branches: list[dict[str, Any]],
    warnings: list[dict[str, Any]],
    loops: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    use_case_code = payload.get("source_use_case_key") or "UC-01"
    use_case_title = payload.get("source_use_case_title") or payload.get("diagram_name") or "Use case hiện tại"

    preconditions: list[dict[str, str]] = []
    if main_flow_steps:
        preconditions.append(
            {
                "name": "Đầu vào khả dụng",
                "detail": normalize_inline_text(
                    main_flow_steps[0].get("input_or_trigger")
                    or "Quy trình đã có tín hiệu hoặc yêu cầu đầu vào để xử lý."
                ),
            }
        )
    preconditions.append(
        {
            "name": "Actor và dữ liệu liên quan sẵn sàng",
            "detail": "Các actor trong diagram có đủ thông tin và quyền thao tác để tiếp tục xử lý.",
        }
    )

    main_flow_rows = [
        {
            "step": str(index),
            "actor": step.get("actor_name") or "Hệ thống",
            "action": normalize_inline_text(
                step.get("business_action") or step.get("step_title") or step.get("description")
            ),
            "outcome": normalize_inline_text(
                step.get("expected_result") or step.get("step_purpose") or "Bước xử lý được hoàn tất."
            ),
        }
        for index, step in enumerate(main_flow_steps, start=1)
    ]

    state_flow: list[str] = []
    if main_flow_steps:
        state_flow.append(
            f'Luồng chính đi từ "{main_flow_steps[0].get("step_title") or main_flow_steps[0].get("description")}" '
            f'đến "{main_flow_steps[-1].get("step_title") or main_flow_steps[-1].get("description")}".'
        )
    if branches:
        state_flow.append(f"Có {len(branches)} điểm quyết định làm thay đổi hướng xử lý.")

    exception_rows = [
        {
            "name": normalize_inline_text(branch.get("decision_text") or "Điểm quyết định"),
            "detail": f"Có {len(branch.get('outcomes', []))} outcome cần được review trong nhánh này.",
        }
        for branch in branches
    ]
    exception_rows.extend(
        {"name": "Cảnh báo", "detail": normalize_inline_text(warning.get("message") or "Warning phát sinh.")}
        for warning in warnings
    )
    exception_rows.extend(
        {"name": "Loop", "detail": normalize_inline_text(loop.get("note") or "Loop phát sinh trong diagram.")}
        for loop in loops
    )

    outcome_rows: list[dict[str, str]] = []
    if main_flow_steps:
        outcome_rows.append(
            {
                "name": "Kết quả kỳ vọng",
                "detail": normalize_inline_text(
                    main_flow_steps[-1].get("expected_result")
                    or main_flow_steps[-1].get("step_title")
                    or "Quy trình khép lại theo kết quả cuối."
                ),
            }
        )
    if branches:
        outcome_rows.append(
            {
                "name": "Kết quả theo nhánh",
                "detail": "Các outcome của decision logic xác định hướng xử lý kế tiếp hoặc nhập lại luồng chính.",
            }
        )

    return [
        {
            "code": use_case_code,
            "title": use_case_title,
            "objective": "Mô tả đầy đủ mục tiêu, điều kiện, luồng chính và ngoại lệ của use case theo diagram hiện tại.",
            "preconditions": preconditions,
            "main_flow_rows": main_flow_rows,
            "state_flow": state_flow,
            "exception_rows": exception_rows,
            "outcome_rows": outcome_rows,
            "figure_caption": f"Luồng chính xử lý cho {use_case_title}.",
        }
    ]
