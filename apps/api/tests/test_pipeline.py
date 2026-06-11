from __future__ import annotations

from app.schemas.common import WarningItem
from app.schemas.request import DiagramSemanticRequest
from app.schemas.spec import DiagramBRDSpec
from app.services.interpret import interpret_request
from app.services.postcheck import postcheck_spec
from app.services.render import render_brd_markdown
from app.services.spec_builder import build_deterministic_spec
from app.services.validate import validate_request


def test_validate_request_blocks_missing_end(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    payload["nodes"] = [node for node in payload["nodes"] if node["type"] != "end"]
    request = DiagramSemanticRequest.model_validate(payload)

    warnings, blocking_issues = validate_request(request)

    assert any(issue.code == "END_REQUIRED" for issue in blocking_issues)
    assert warnings == []


def test_reader_facing_markdown_keeps_raw_ids_in_appendix_only(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    request = DiagramSemanticRequest.model_validate(payload)
    warnings = [
        WarningItem(
            code="GRAPH_HAS_LOOP",
            severity="warning",
            message="Diagram có loop.",
            related_node_ids=["n-dec1", "n-b1"],
        )
    ]
    interpreted = interpret_request(request, warnings)
    spec = DiagramBRDSpec.model_validate(
        build_deterministic_spec(
            payload=request.model_dump(mode="python"),
            interpreted=interpreted,
            warnings=[warning.model_dump(mode="python") for warning in warnings],
            model_name="openai/gpt-5.5",
        )
    )

    reader_facing_markdown = render_brd_markdown(spec)
    markdown_with_appendix = render_brd_markdown(spec, template="full")
    appendix = markdown_with_appendix.split("## Appendix A. Traceability (debug)")[1]

    assert "## 1. Mục đích tài liệu" in reader_facing_markdown
    assert "Mục tiêu nghiệp vụ được suy ra từ flow hiện tại" not in reader_facing_markdown
    assert "Bảo đảm sự kiện hoặc yêu cầu đầu vào được tiếp nhận đầy đủ" in reader_facing_markdown
    assert "### 6.5. Luồng ngoại lệ" in reader_facing_markdown
    assert "| Loop | Phát hiện retry/escalation loop trong diagram. |" in reader_facing_markdown
    assert "Context / assumptions / open questions" in reader_facing_markdown
    assert 'Annotation: Note cho bước "Xử lý yêu cầu": Cần xác nhận BA' in reader_facing_markdown
    assert "| Actor | Vai trò |" in reader_facing_markdown
    assert "Có: Tiếp tục: [Nhân sự xử lý] Xử lý yêu cầu." in reader_facing_markdown
    assert "Quy trình bắt đầu khi có tín hiệu hoặc yêu cầu đầu vào; sau đó VOC tiếp nhận và điều phối xử lý ban đầu." in reader_facing_markdown
    assert "n-a1" not in reader_facing_markdown
    assert "n-dec1" not in reader_facing_markdown
    assert "lane-a" not in reader_facing_markdown
    assert "## Appendix A. Traceability (debug)" not in reader_facing_markdown
    assert "S01 -> n-a1" in appendix
    assert "Đủ thông tin? -> n-dec1" in appendix


def test_interpret_follows_graph_topology_instead_of_canvas_coordinates() -> None:
    request = DiagramSemanticRequest.model_validate(
        {
            "diagram_name": "Topology first",
            "language": "vi",
            "lanes": [{"id": "lane-a", "title": "VOC", "order": 0}],
            "nodes": [
                {"id": "n-start", "type": "start", "x": 100, "y": 100},
                {"id": "n-a1", "type": "activity", "lane_id": "lane-a", "text": "Buoc 1", "x": 120, "y": 200},
                {"id": "n-a2", "type": "activity", "lane_id": "lane-a", "text": "Buoc 2", "x": 120, "y": 400},
                {"id": "n-a3", "type": "activity", "lane_id": "lane-a", "text": "Buoc 3", "x": 120, "y": 300},
                {"id": "n-end", "type": "end", "x": 120, "y": 500},
                {"id": "n-orphan", "type": "activity", "lane_id": "lane-a", "text": "Node roi", "x": 120, "y": 150},
            ],
            "edges": [
                {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
                {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-a2"},
                {"id": "e3", "source_node_id": "n-a2", "target_node_id": "n-a3"},
                {"id": "e4", "source_node_id": "n-a3", "target_node_id": "n-end"},
            ],
        }
    )

    interpreted = interpret_request(request, [])
    main_flow_ids = [node.id for node in interpreted["main_flow_nodes"]]

    assert main_flow_ids == ["n-a1", "n-a2", "n-a3", "n-end"]
    assert "Node roi" in interpreted["open_questions"][0]


def test_branch_summary_separates_main_spine_from_alternate_path(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    request = DiagramSemanticRequest.model_validate(payload)

    interpreted = interpret_request(request, [])
    main_flow_ids = [node.id for node in interpreted["main_flow_nodes"]]
    branch = interpreted["branches"][0]
    no_outcome = next(outcome for outcome in branch["outcomes"] if outcome["label"] is None)

    assert main_flow_ids == ["n-a1", "n-dec1", "n-b1", "n-end"]
    assert no_outcome["path_summary"] == ["Kết thúc quy trình"]
    assert no_outcome["target_node_id"] == "n-end"


def test_branch_outcome_marks_main_path_continuation(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    request = DiagramSemanticRequest.model_validate(payload)

    interpreted = interpret_request(request, [])
    branch = interpreted["branches"][0]
    yes_outcome = next(outcome for outcome in branch["outcomes"] if outcome["label"] == "Có")

    assert yes_outcome["continues_main_flow"] is True
    assert yes_outcome["rejoin_node_text"] == "[Nhân sự xử lý] Kết thúc quy trình" or yes_outcome["rejoin_node_text"] == "Kết thúc quy trình"


def test_postcheck_warns_when_branch_target_is_not_traceable() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "Postcheck demo",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-05-31T10:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Demo summary",
            "actors": [],
            "main_flow_steps": [
                {
                    "step_id": "S01",
                    "node_id": "n-a1",
                    "description": "Buoc 1",
                }
            ],
            "branches": [
                {
                    "decision_node_id": "n-dec1",
                    "decision_text": "Hop le?",
                    "outcomes": [{"label": "Co", "target_node_id": "n-missing", "status": "labeled"}],
                }
            ],
            "parallel_blocks": [],
            "handoffs": [],
            "loops": [],
            "annotations": [],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    warnings = postcheck_spec(spec, traceable_node_ids={"n-a1", "n-dec1"})

    assert any(item.code == "BRANCH_TARGET_UNKNOWN" for item in warnings)


def test_postcheck_allows_branch_target_outside_main_flow_if_traceable() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "Postcheck valid branch",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-05-31T10:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Demo summary",
            "actors": [],
            "main_flow_steps": [
                {
                    "step_id": "S01",
                    "node_id": "n-a1",
                    "description": "Buoc 1",
                }
            ],
            "branches": [
                {
                    "decision_node_id": "n-dec1",
                    "decision_text": "Hop le?",
                    "outcomes": [{"label": "Khong", "target_node_id": "n-alt", "status": "labeled"}],
                }
            ],
            "parallel_blocks": [],
            "handoffs": [],
            "loops": [],
            "annotations": [],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    warnings = postcheck_spec(spec, traceable_node_ids={"n-a1", "n-dec1", "n-alt", "n-end"})

    assert not any(item.code == "BRANCH_TARGET_UNKNOWN" for item in warnings)


def test_validate_and_interpret_global_note_when_far_from_flow(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    payload["nodes"] = [
        node if node["id"] != "n-note" else {**node, "x": 920, "y": 980}
        for node in payload["nodes"]
    ]
    request = DiagramSemanticRequest.model_validate(payload)

    warnings, blocking_issues = validate_request(request)
    interpreted = interpret_request(request, warnings)

    assert blocking_issues == []
    assert any(item.code == "NOTE_ORPHAN" for item in warnings)
    assert interpreted["annotations"] == []
    assert any("không xác định được vị trí trong flow" in item for item in interpreted["assumptions"])


def test_interpret_context_note_near_start_is_not_step_annotation() -> None:
    request = DiagramSemanticRequest.model_validate(
        {
            "diagram_name": "Context note demo",
            "language": "vi",
            "lanes": [{"id": "lane-a", "title": "Nguồn phát hiện", "order": 0}],
            "nodes": [
                {"id": "n-start", "type": "start", "x": 120, "y": 110},
                {
                    "id": "n-note",
                    "type": "note",
                    "lane_id": "lane-a",
                    "text": "1 trong 4 nhóm phát hiện:\n- Sensor\n- Khán giả\n- Hotline",
                    "x": 120,
                    "y": 180,
                },
                {
                    "id": "n-a1",
                    "type": "activity",
                    "lane_id": "lane-a",
                    "text": "Tiếp nhận tín hiệu ban đầu",
                    "x": 120,
                    "y": 340,
                },
                {"id": "n-end", "type": "end", "x": 120, "y": 480},
            ],
            "edges": [
                {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
                {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-end"},
            ],
        }
    )

    interpreted = interpret_request(request, [])

    assert interpreted["annotations"] == []
    assert interpreted["context_notes"] == [
        "1 trong 4 nhóm phát hiện:\n- Sensor\n- Khán giả\n- Hotline"
    ]


def test_render_section_10_does_not_emit_empty_state_when_context_exists() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "Context only demo",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-06-01T10:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Demo summary",
            "actors": [],
            "main_flow_steps": [],
            "branches": [],
            "parallel_blocks": [],
            "handoffs": [],
            "loops": [],
            "annotations": [],
            "context_notes": [
                "1 trong 4 nhóm phát hiện dấu hiệu cháy:\n- Hệ thống tự động: Sensor báo khói, nhiệt\n- Khán giả: Nút báo cháy"
            ],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    section_10 = render_brd_markdown(spec)

    assert "Context / assumptions / open questions" in section_10
    assert "- Context: 1 trong 4 nhóm phát hiện dấu hiệu cháy." in section_10
    assert "  - Hệ thống tự động: Sensor báo khói, nhiệt" in section_10
    assert "  - Khán giả: Nút báo cháy" in section_10
    assert "- Không có assumption/open question." not in section_10
    assert "- Không có giả định hoặc câu hỏi mở nổi bật." not in section_10


def test_render_alternate_branch_uses_narrative_wording_instead_of_arrow_trace() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "Decision wording demo",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-06-01T10:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Demo summary",
            "actors": [],
            "main_flow_steps": [],
            "branches": [
                {
                    "decision_node_id": "n-dec1",
                    "decision_text": "Có thể xử lý nhanh không?",
                    "decision_actor_name": "Nhân viên hiện trường",
                    "outcomes": [
                        {
                            "label": "Không",
                            "target_node_id": "n-b2",
                            "status": "labeled",
                            "path_summary": [
                                "[Trưởng điều phối] Xác nhận thông tin sai",
                                "[Trưởng điều phối] Báo cáo kết quả xác minh",
                            ],
                            "rejoin_node_id": "n-end",
                            "rejoin_node_text": "[Trưởng điều phối] Kết thúc quy trình",
                        }
                    ],
                }
            ],
            "parallel_blocks": [],
            "handoffs": [],
            "loops": [],
            "annotations": [],
            "context_notes": [],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    markdown = render_brd_markdown(spec)

    assert "Thực hiện lần lượt [Trưởng điều phối] Xác nhận thông tin sai, rồi [Trưởng điều phối] Báo cáo kết quả xác minh; sau đó nhập lại luồng chính tại [Trưởng điều phối] Kết thúc quy trình." in markdown
    assert "->" not in markdown


def test_deterministic_summary_mentions_trigger_context_and_first_actor() -> None:
    payload = {
        "diagram_name": "Fire incident demo",
        "language": "vi",
        "lanes": [
            {"id": "lane-source", "title": "Nguồn phát hiện đầu tiên", "order": 0},
            {"id": "lane-voc", "title": "Nhân sự vận hành liên lạc (VOC)", "order": 1},
        ],
        "nodes": [
            {"id": "n-start", "type": "start", "x": 120, "y": 90},
            {
                "id": "n-note",
                "type": "note",
                "lane_id": "lane-source",
                "text": "1 trong 4 nhóm phát hiện dấu hiệu cháy:\n- Sensor\n- Khán giả",
                "x": 120,
                "y": 160,
            },
            {
                "id": "n-a1",
                "type": "activity",
                "lane_id": "lane-voc",
                "text": "Tiếp nhận tín hiệu ban đầu",
                "x": 320,
                "y": 280,
            },
            {"id": "n-end", "type": "end", "x": 320, "y": 420},
        ],
        "edges": [
            {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
            {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-end"},
        ],
    }
    request = DiagramSemanticRequest.model_validate(payload)
    interpreted = interpret_request(request, [])

    spec = DiagramBRDSpec.model_validate(
        build_deterministic_spec(
            payload=request.model_dump(mode="python"),
            interpreted=interpreted,
            warnings=[],
            model_name="openai/gpt-5.5",
        )
    )

    assert "Quy trình được kích hoạt từ Nguồn phát hiện đầu tiên." in spec.summary
    assert "Bối cảnh đầu vào gồm: 1 trong 4 nhóm phát hiện dấu hiệu cháy." in spec.summary
    assert "Sau đó Nhân sự vận hành liên lạc (VOC) tiếp nhận và điều phối xử lý ban đầu." in spec.summary
    assert "Quy trình mô tả cách các actor phối hợp tiếp nhận tín hiệu, xác minh hiện trường, và xử lý sự cố cháy theo diagram hiện tại." in spec.summary


def test_render_business_objective_matches_fire_incident_context() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "Fire incident objective",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-06-02T09:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Quy trình mô tả cách các actor phối hợp tiếp nhận tín hiệu, xác minh hiện trường, và xử lý sự cố cháy theo diagram hiện tại.",
            "actors": [],
            "main_flow_steps": [
                {
                    "step_id": "S01",
                    "node_id": "n-a1",
                    "description": "Tiếp nhận tín hiệu ban đầu",
                },
                {
                    "step_id": "S02",
                    "node_id": "n-b1",
                    "description": "Điều phối nhân viên hiện trường đến điểm nghi vấn",
                },
            ],
            "branches": [
                {
                    "decision_node_id": "n-dec1",
                    "decision_text": "Xác minh sự cố là cháy thật?",
                    "outcomes": [],
                }
            ],
            "parallel_blocks": [],
            "handoffs": [],
            "loops": [],
            "annotations": [],
            "context_notes": ["1 trong 4 nhóm phát hiện dấu hiệu cháy:\n- Sensor báo khói"],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    markdown = render_brd_markdown(spec)

    assert "Bảo đảm tín hiệu nghi ngờ cháy được tiếp nhận kịp thời, xác minh nhanh tại hiện trường, điều phối xử lý phù hợp, và khép quy trình an toàn theo kết quả xác minh." in markdown


def test_reader_facing_markdown_normalizes_multiline_canvas_text() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "Whitespace demo",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-06-01T10:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Demo summary",
            "actors": [{"lane_id": "lane-a", "actor_name": "VOC", "responsibilities": []}],
            "main_flow_steps": [
                {
                    "step_id": "S01",
                    "node_id": "n-a1",
                    "actor_lane_id": "lane-a",
                    "actor_name": "VOC",
                    "description": "Báo cáo qua bộ đàm về kết quả xác minh\ncho các actor trong VOC",
                }
            ],
            "branches": [
                {
                    "decision_node_id": "n-dec1",
                    "decision_text": "Xác minh sự cố\nlà cháy thật?",
                    "decision_actor_name": "Nhân viên hiện trường",
                    "outcomes": [
                        {
                            "label": "Không",
                            "target_node_id": "n-b1",
                            "status": "labeled",
                            "path_summary": [
                                "[Trưởng điều phối] Xác nhận thông tin sai",
                                "[Trưởng điều phối] Báo cáo qua bộ đàm về kết quả xác minh\ncho các actor trong VOC",
                            ],
                            "rejoin_node_id": "n-end",
                            "rejoin_node_text": "[Trưởng điều phối] Kết thúc quy trình",
                        }
                    ],
                }
            ],
            "parallel_blocks": [],
            "handoffs": [
                {
                    "from_actor": "Trưởng điều phối khán giả (VOC)",
                    "to_actor": "Nhân viên hiện trường",
                    "source_node_id": "n-b1",
                    "target_node_id": "n-c1",
                    "reason": 'Bàn giao xử lý từ bước "Điều phối nhân viên hiện trường gần nhất\nqua bộ đàm đến điểm nghi vấn" sang bước "Di chuyển đến điểm nghi vấn để kiểm tra".',
                }
            ],
            "loops": [],
            "annotations": [],
            "context_notes": [],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    reader_facing_markdown = render_brd_markdown(spec)

    assert "Xác minh sự cố là cháy thật?" in reader_facing_markdown
    assert "Báo cáo qua bộ đàm về kết quả xác minh cho các actor trong VOC" in reader_facing_markdown
    assert "Điều phối nhân viên hiện trường gần nhất qua bộ đàm đến điểm nghi vấn" in reader_facing_markdown
    assert "#### Hoạt động song song" not in reader_facing_markdown
    assert "#### Handoffs" in reader_facing_markdown
    assert "Xác minh sự cố\nlà cháy thật?" not in reader_facing_markdown
    assert "kết quả xác minh\ncho các actor" not in reader_facing_markdown
    assert "gần nhất\nqua bộ đàm" not in reader_facing_markdown


def test_render_main_workflow_uses_brd_rich_step_format(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    request = DiagramSemanticRequest.model_validate(payload)
    interpreted = interpret_request(request, [])

    spec = DiagramBRDSpec.model_validate(
        build_deterministic_spec(
            payload=request.model_dump(mode="python"),
            interpreted=interpreted,
            warnings=[],
            model_name="openai/gpt-5.5",
        )
    )

    markdown = render_brd_markdown(spec)

    assert "### 6.3. Luồng chính" in markdown
    assert "| Bước | Actor | Hành động | Kết quả / trạng thái |" in markdown
    assert "| 1 | VOC | VOC tiếp nhận tín hiệu hoặc tin báo ban đầu từ nguồn khởi phát liên quan. |" in markdown


def test_render_scope_actors_and_template_modes_support_reader_facing_brd(valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    request = DiagramSemanticRequest.model_validate(payload)
    interpreted = interpret_request(request, [])

    spec = DiagramBRDSpec.model_validate(
        build_deterministic_spec(
            payload=request.model_dump(mode="python"),
            interpreted=interpreted,
            warnings=[],
            model_name="openai/gpt-5.5",
        )
    )

    default_markdown = render_brd_markdown(spec)
    full_markdown = render_brd_markdown(spec, template="full")

    assert "## 2. Phạm vi nghiệp vụ" in default_markdown
    assert "| Nhóm nghiệp vụ | Nội dung |" in default_markdown
    assert "## 3. Actor" in default_markdown
    assert "| Actor | Vai trò |" in default_markdown
    assert "Tiếp nhận, ghi nhận, và lưu vết thông tin ban đầu của quy trình." in default_markdown
    assert "Kiểm tra, xác minh, và xác định hướng xử lý tiếp theo theo tình huống thực tế." in default_markdown
    assert "Thực hiện hoặc theo dõi biện pháp xử lý phù hợp với tình huống đã được xác minh." in default_markdown
    assert "## Appendix A. Traceability (debug)" not in default_markdown
    assert "## Appendix A. Traceability (debug)" in full_markdown


def test_render_matches_sample_inspired_document_outline_and_tables() -> None:
    spec = DiagramBRDSpec.model_validate(
        {
            "metadata": {
                "diagram_name": "BQL xử lý camera re-id",
                "source_language": "vi",
                "generated_language": "vi",
                "generated_at": "2026-06-10T09:00:00Z",
                "generator_model": "openai/gpt-5.5",
                "generator_version": "mock-deterministic-v1",
            },
            "summary": "Tài liệu mô tả quy trình BQL tiếp nhận, xác minh và xử lý yêu cầu camera re-id.",
            "actors": [
                {
                    "lane_id": "lane-1",
                    "actor_name": "Ban quản lý",
                    "responsibilities": [
                        "Tiếp nhận yêu cầu và xác minh thông tin ban đầu.",
                        "Điều phối xử lý và xác nhận kết quả cuối cùng.",
                    ],
                },
                {
                    "lane_id": "lane-2",
                    "actor_name": "Portal",
                    "responsibilities": [
                        "Lưu trạng thái xử lý, gửi thông báo và cập nhật dữ liệu hệ thống."
                    ],
                },
            ],
            "main_flow_steps": [
                {
                    "step_id": "S01",
                    "node_id": "n-a1",
                    "actor_lane_id": "lane-1",
                    "actor_name": "Ban quản lý",
                    "step_title": "Tiếp nhận yêu cầu",
                    "step_purpose": "Ghi nhận thông tin đầu vào.",
                    "business_action": "Mở chi tiết yêu cầu và kiểm tra dữ liệu.",
                    "expected_result": "Yêu cầu sẵn sàng để xử lý tiếp.",
                    "input_or_trigger": "Yêu cầu camera re-id mới.",
                    "description": "Tiếp nhận yêu cầu",
                },
                {
                    "step_id": "S02",
                    "node_id": "n-a2",
                    "actor_lane_id": "lane-2",
                    "actor_name": "Portal",
                    "step_title": "Cập nhật kết quả",
                    "step_purpose": "Lưu kết quả xử lý.",
                    "business_action": "Cập nhật trạng thái và gửi thông báo.",
                    "expected_result": "Cư dân nhận được trạng thái cuối.",
                    "input_or_trigger": "BQL đã xác nhận kết quả.",
                    "description": "Cập nhật kết quả",
                },
            ],
            "branches": [
                {
                    "decision_node_id": "n-dec1",
                    "decision_text": "Thông tin hợp lệ?",
                    "decision_actor_name": "Ban quản lý",
                    "outcomes": [
                        {
                            "label": "Có",
                            "target_node_id": "n-a2",
                            "status": "labeled",
                            "path_summary": ["[Portal] Cập nhật kết quả"],
                            "continues_main_flow": True,
                        }
                    ],
                }
            ],
            "parallel_blocks": [],
            "handoffs": [],
            "loops": [],
            "annotations": [],
            "context_notes": [],
            "assumptions": [],
            "open_questions": [],
            "warnings": [],
        }
    )

    markdown = render_brd_markdown(spec)

    assert "## 1. Mục đích tài liệu" in markdown
    assert "## 2. Phạm vi nghiệp vụ" in markdown
    assert "| Nhóm nghiệp vụ | Nội dung |" in markdown
    assert "## 3. Actor" in markdown
    assert "| Actor | Vai trò |" in markdown
    assert "## 4. Danh sách user case trong tài liệu" in markdown
    assert "| Mã UC | Tên user case | Mục tiêu |" in markdown
    assert "## 6. UC-01:" in markdown
    assert "| Bước | Actor | Hành động | Kết quả / trạng thái |" in markdown
    assert "![Hình 1]" in markdown


def test_non_branching_sync_bar_does_not_create_parallel_block() -> None:
    request = DiagramSemanticRequest.model_validate(
        {
            "diagram_name": "Linear sync demo",
            "language": "vi",
            "lanes": [
                {"id": "lane-a", "title": "VOC", "order": 0},
                {"id": "lane-b", "title": "Đội xử lý", "order": 1},
            ],
            "nodes": [
                {"id": "n-start", "type": "start", "x": 100, "y": 100},
                {"id": "n-a1", "type": "activity", "lane_id": "lane-a", "text": "Thông báo", "x": 120, "y": 200},
                {"id": "n-sync", "type": "sync-bar", "x": 220, "y": 300},
                {"id": "n-b1", "type": "activity", "lane_id": "lane-b", "text": "Tiếp nhận", "x": 320, "y": 420},
                {"id": "n-end", "type": "end", "x": 320, "y": 540},
            ],
            "edges": [
                {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
                {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-sync"},
                {"id": "e3", "source_node_id": "n-sync", "target_node_id": "n-b1"},
                {"id": "e4", "source_node_id": "n-b1", "target_node_id": "n-end"},
            ],
        }
    )

    interpreted = interpret_request(request, [])

    assert interpreted["parallel_blocks"] == []


def test_interpret_sync_bar_parallel_block_with_join_candidate() -> None:
    request = DiagramSemanticRequest.model_validate(
        {
            "diagram_name": "Parallel demo",
            "language": "vi",
            "lanes": [
                {"id": "lane-a", "title": "Actor A", "order": 0},
                {"id": "lane-b", "title": "Actor B", "order": 1},
            ],
            "nodes": [
                {"id": "n-start", "type": "start", "x": 100, "y": 100},
                {"id": "n-a1", "type": "activity", "lane_id": "lane-a", "text": "Buoc chuan bi", "x": 100, "y": 200},
                {"id": "n-fork", "type": "sync-bar", "x": 200, "y": 300},
                {"id": "n-a2", "type": "activity", "lane_id": "lane-a", "text": "Nhanh A", "x": 100, "y": 420},
                {"id": "n-b1", "type": "activity", "lane_id": "lane-b", "text": "Nhanh B", "x": 320, "y": 420},
                {"id": "n-join", "type": "sync-bar", "x": 220, "y": 560},
                {"id": "n-end", "type": "end", "x": 220, "y": 700},
            ],
            "edges": [
                {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
                {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-fork"},
                {"id": "e3", "source_node_id": "n-fork", "target_node_id": "n-a2"},
                {"id": "e4", "source_node_id": "n-fork", "target_node_id": "n-b1"},
                {"id": "e5", "source_node_id": "n-a2", "target_node_id": "n-join"},
                {"id": "e6", "source_node_id": "n-b1", "target_node_id": "n-join"},
                {"id": "e7", "source_node_id": "n-join", "target_node_id": "n-end"},
            ],
        }
    )

    interpreted = interpret_request(request, [])
    fork_block = next(block for block in interpreted["parallel_blocks"] if block["fork_node_id"] == "n-fork")

    assert fork_block["join_node_id"] == "n-join"
    assert fork_block["actor_names"] == ["Actor A", "Actor B"]
    assert "Actor A: Nhanh A" in fork_block["description"]
    assert "Actor B: Nhanh B" in fork_block["description"]
    assert "Kết thúc quy trình" in (fork_block["join_summary"] or "")
    assert not any(
        block["fork_node_id"] == "n-join" and block.get("join_node_id") == "n-join"
        for block in interpreted["parallel_blocks"]
    )


def test_interpret_business_handoff_requires_meaningful_cross_lane_steps() -> None:
    request = DiagramSemanticRequest.model_validate(
        {
            "diagram_name": "Handoff demo",
            "language": "vi",
            "lanes": [
                {"id": "lane-a", "title": "VOC", "order": 0},
                {"id": "lane-b", "title": "Đội xử lý", "order": 1},
            ],
            "nodes": [
                {"id": "n-start", "type": "start", "x": 80, "y": 80},
                {"id": "n-a1", "type": "activity", "lane_id": "lane-a", "text": "Tiếp nhận yêu cầu", "x": 120, "y": 180},
                {"id": "n-b1", "type": "activity", "lane_id": "lane-b", "text": "Xử lý yêu cầu", "x": 340, "y": 260},
                {"id": "n-dec1", "type": "decision", "lane_id": "lane-b", "text": "Cần escalte?", "x": 340, "y": 360},
                {"id": "n-end", "type": "end", "x": 340, "y": 460},
            ],
            "edges": [
                {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
                {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-b1"},
                {"id": "e3", "source_node_id": "n-b1", "target_node_id": "n-dec1"},
                {"id": "e4", "source_node_id": "n-dec1", "target_node_id": "n-end", "label": "Không"},
            ],
        }
    )

    interpreted = interpret_request(request, [])

    assert interpreted["handoffs"] == [
        {
            "from_actor": "VOC",
            "to_actor": "Đội xử lý",
            "source_node_id": "n-a1",
            "target_node_id": "n-b1",
            "source_step_text": "Tiếp nhận yêu cầu",
            "target_step_text": "Xử lý yêu cầu",
            "reason": 'Bàn giao xử lý từ bước "Tiếp nhận yêu cầu" sang bước "Xử lý yêu cầu".',
        }
    ]
