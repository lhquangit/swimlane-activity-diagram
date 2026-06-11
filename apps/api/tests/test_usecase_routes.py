from __future__ import annotations

import pytest

from app.ai.providers import MockProvider
from app.config import Settings
from app.routes import usecase_generate
from app.usecases.generation_service import UseCaseGenerationService
from test_usecase_synthesis import valid_synthesis_payload


SCHEMA_HEADERS = {"X-Schema-Version": "2026-05-31"}


@pytest.fixture(autouse=True)
def install_mock_generation_service(monkeypatch):
    original = usecase_generate.generation_service
    settings = Settings(
        usecase_provider="openrouter",
        usecase_generation_mode="ai_default",
        usecase_model="mock/usecase-model",
        usecase_prompt_version="1.2.0",
        usecase_max_attempts=2,
        ai_openrouter_api_key="sk-test",
        openrouter_api_key="sk-test",
    )
    monkeypatch.setattr(
        usecase_generate,
        "generation_service",
        UseCaseGenerationService(
            settings,
            provider_factory=lambda _name, _settings: MockProvider(valid_synthesis_payload),
        ),
    )
    try:
        yield
    finally:
        monkeypatch.setattr(usecase_generate, "generation_service", original)


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
        "generation_preference": "ai",
    }


def test_generate_usecases_returns_ai_artifact_chain_and_usecases(client) -> None:
    response = client.post(
        "/api/usecases/generate",
        json=valid_usecase_payload(),
        headers=SCHEMA_HEADERS,
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "completed"
    assert body["metadata"]["generation_source"] == "ai"
    assert body["result"]["generation_source"] == "ai"
    assert body["result"]["artifact_chain"][0]["artifact_type"] == "project_spec"
    assert body["result"]["artifact_chain"][-1]["artifact_type"] == "formal_brd_draft"
    assert body["result"]["use_cases"]
    assert body["result"]["use_cases"][0]["review_status"] == "draft"


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


def test_generate_usecases_fails_closed_when_ai_provider_is_unavailable(client, monkeypatch) -> None:
    original = usecase_generate.generation_service

    class FailingService:
        def generate(self, *_args, **_kwargs):
            from app.schemas.common import ResponseMetadata
            from app.usecases.generation_service import UseCaseGenerationFailure

            raise UseCaseGenerationFailure(
                code="USECASE_AI_PROVIDER_FAILURE",
                message="AI provider tạm thời không khả dụng cho Use Case.",
                retryable=True,
                status_code=502,
                metadata=ResponseMetadata(
                    capability="usecase_synthesis",
                    provider="openrouter",
                    model="openai/gpt-5.5",
                    fallback_reason="USECASE_AI_PROVIDER_FAILURE",
                ),
            )

    monkeypatch.setattr(usecase_generate, "generation_service", FailingService())
    try:
        response = client.post(
            "/api/usecases/generate",
            json=valid_usecase_payload(),
            headers=SCHEMA_HEADERS,
        )
    finally:
        monkeypatch.setattr(usecase_generate, "generation_service", original)

    body = response.json()
    assert response.status_code == 502
    assert body["status"] == "failed"
    assert body["error"]["code"] == "USECASE_AI_PROVIDER_FAILURE"
    assert body["result"] == {}
