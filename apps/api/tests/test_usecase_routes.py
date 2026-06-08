from __future__ import annotations

from app.routes import usecase_generate


SCHEMA_HEADERS = {"X-Schema-Version": "2026-05-31"}


def valid_usecase_payload() -> dict:
    return {
        "project_spec": {
            "project_name": "V-PetSafe",
            "project_summary": "Nền tảng quản lý cư dân và dịch vụ nội khu.",
            "business_context": "Ban quản lý cần xử lý yêu cầu GPS cho thú nuôi.",
            "target_users": ["Ban quản lý", "Cư dân"],
            "business_rules": [
                "Chỉ cấp phát thiết bị khi có GPS Device khả dụng.",
                "Phải lưu lịch sử thay đổi trạng thái.",
            ],
            "glossary": ["GPS Device", "Portal", "V-app"],
        },
        "feature_intent": {
            "feature_name": "Cấp phát GPS Device",
            "function_name": "gps-device-issue",
            "feature_summary": "Xử lý yêu cầu cấp phát và lắp đặt GPS cho thú nuôi.",
            "primary_actor": "Ban quản lý",
            "trigger": "Có yêu cầu đăng ký GPS hợp lệ từ cư dân.",
            "inputs": ["Yêu cầu GPS", "Danh sách GPS Device trong kho"],
            "outputs": ["Trạng thái yêu cầu", "Trạng thái GPS Device", "Thông báo cư dân"],
            "constraints": ["Thiết bị phải ở trạng thái Trong kho trước khi giữ chỗ."],
            "assumptions": ["Portal là hệ thống thao tác chính của BQL."],
            "systems_involved": ["Portal", "V-app"],
            "success_outcome": "Yêu cầu GPS được cấp phát thành công và cư dân nhận được thông báo.",
        },
        "language": "vi",
    }


def test_generate_usecases_returns_artifact_chain_and_usecases(client) -> None:
    response = client.post(
        "/api/usecases/generate",
        json=valid_usecase_payload(),
        headers=SCHEMA_HEADERS,
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "completed"
    assert body["metadata"]["provider"] == "deterministic"
    assert body["metadata"]["generation_source"] == "deterministic_fallback"
    assert body["result"]["generation_source"] == "deterministic_fallback"
    assert body["result"]["artifact_chain"][0]["artifact_type"] == "project_spec"
    assert body["result"]["artifact_chain"][-1]["artifact_type"] == "formal_brd_draft"
    assert len(body["result"]["use_cases"]) == 4
    assert body["result"]["use_cases"][0]["review_status"] == "draft"
    assert "Ban quản lý" == body["result"]["use_cases"][0]["primary_actor"]
    assert body["result"]["use_cases"][0]["main_flow_steps"][0]["step_id"].endswith("-S01")
    assert body["result"]["use_cases"][0]["alternate_flows"][0]["source_step_id"]


def test_generate_usecases_accepts_minimal_visible_input(client) -> None:
    response = client.post(
        "/api/usecases/generate",
        json={
            "project_spec": {
                "project_name": "Current project",
                "project_summary": "Project context.",
            },
            "feature_intent": {
                "feature_name": "Update request",
                "feature_summary": "Update one business request.",
                "primary_actor": "Operator",
            },
            "language": "vi",
        },
        headers=SCHEMA_HEADERS,
    )

    assert response.status_code == 200
    use_cases = response.json()["result"]["use_cases"]
    assert use_cases
    assert all(use_case["main_flow_steps"] for use_case in use_cases)
    assert all(use_case["primary_actor"] == "Operator" for use_case in use_cases)


def test_generate_usecases_rejects_invalid_schema_version(client) -> None:
    response = client.post(
        "/api/usecases/generate",
        json=valid_usecase_payload(),
        headers={"X-Schema-Version": "2026-01-01"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SCHEMA_VERSION"


def test_generate_usecases_returns_429_when_rate_limited(client, monkeypatch) -> None:
    monkeypatch.setattr(usecase_generate.rate_limiter, "allow", lambda key: (False, 11))

    response = client.post(
        "/api/usecases/generate",
        json=valid_usecase_payload(),
        headers=SCHEMA_HEADERS,
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"


def test_generate_usecases_rejects_blank_required_fields(client) -> None:
    payload = valid_usecase_payload()
    payload["project_spec"]["project_name"] = "   "
    payload["feature_intent"]["feature_summary"] = "   "

    response = client.post(
        "/api/usecases/generate",
        json=payload,
        headers=SCHEMA_HEADERS,
    )
    body = response.json()

    assert response.status_code == 422
    assert body["error"]["code"] == "INVALID_REQUEST"


def test_generate_usecases_returns_canonically_normalized_payload(client) -> None:
    payload = valid_usecase_payload()
    payload["project_spec"]["project_name"] = "  V-PetSafe  "
    payload["project_spec"]["target_users"] = [" Ban quản lý ", "Cư dân", "Cư dân", "   "]
    payload["feature_intent"]["feature_name"] = "  Cấp phát GPS Device  "
    payload["feature_intent"]["systems_involved"] = [" Portal ", "V-app", "Portal"]

    response = client.post(
        "/api/usecases/generate",
        json=payload,
        headers=SCHEMA_HEADERS,
    )
    body = response.json()

    assert response.status_code == 200
    assert body["result"]["project_spec"]["project_name"] == "V-PetSafe"
    assert body["result"]["project_spec"]["target_users"] == ["Ban quản lý", "Cư dân"]
    assert body["result"]["feature_intent"]["feature_name"] == "Cấp phát GPS Device"
    assert body["result"]["feature_intent"]["systems_involved"] == ["Portal", "V-app"]


def test_generate_diagram_requires_approved_use_case_and_returns_traceable_graph(client) -> None:
    usecase_response = client.post(
        "/api/usecases/generate",
        json=valid_usecase_payload(),
        headers=SCHEMA_HEADERS,
    )
    use_case = usecase_response.json()["result"]["use_cases"][0]

    blocked = client.post(
        "/api/diagrams/generate",
        json={"use_case": use_case, "language": "vi"},
        headers=SCHEMA_HEADERS,
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "USE_CASE_NOT_APPROVED"

    use_case["review_status"] = "approved"
    response = client.post(
        "/api/diagrams/generate",
        json={"use_case": use_case, "language": "vi"},
        headers=SCHEMA_HEADERS,
    )
    body = response.json()

    assert response.status_code == 200
    assert body["result"]["diagram"]["use_case_id"] == use_case["use_case_id"]
    assert body["result"]["diagram"]["generation_status"] == "ready"
    assert body["result"]["diagram"]["nodes"]
    assert all(
        node["trace"]["use_case_id"] == use_case["use_case_id"]
        for node in body["result"]["diagram"]["nodes"]
    )


def test_generate_diagram_rejects_invalid_detailed_contract(client) -> None:
    usecase_response = client.post(
        "/api/usecases/generate",
        json=valid_usecase_payload(),
        headers=SCHEMA_HEADERS,
    )
    use_case = usecase_response.json()["result"]["use_cases"][0]
    use_case["review_status"] = "approved"
    use_case["main_flow_steps"] = []

    response = client.post(
        "/api/diagrams/generate",
        json={"use_case": use_case, "language": "vi"},
        headers=SCHEMA_HEADERS,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
