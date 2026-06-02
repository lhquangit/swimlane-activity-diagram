from __future__ import annotations

from types import SimpleNamespace

from app.providers.base import ProviderResult, ProviderUsage
from app.idempotency import IdempotencyEntry, utc_now
from app.routes import brd_generate
from app.routes import brd_validate
from app.providers.openrouter_provider import OpenRouterProviderError


SCHEMA_HEADERS = {"X-Schema-Version": "2026-05-31"}


def test_validate_endpoint_returns_summary_and_warnings(client, valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)

    response = client.post("/api/brd/validate", json=payload, headers=SCHEMA_HEADERS)
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["result"]["normalized_summary"] == {
        "lane_count": 2,
        "node_count": 6,
        "edge_count": 5,
    }
    assert any(item["code"] == "DECISION_UNLABELED" for item in body["warnings"])


def test_generate_requires_idempotency_key(client, valid_generate_payload: dict) -> None:
    response = client.post("/api/brd/generate", json=valid_generate_payload, headers=SCHEMA_HEADERS)
    body = response.json()

    assert response.status_code == 400
    assert body["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


def test_generate_completed_then_replayed(client, monkeypatch, valid_generate_payload: dict) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="mock",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )

    response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-1"},
    )
    replayed_response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-1"},
    )

    first_body = response.json()
    replayed_body = replayed_response.json()

    assert response.status_code == 200
    assert first_body["status"] == "completed"
    assert first_body["result"]["brd_markdown"].startswith("# Diagram BRD Demo")

    assert replayed_response.status_code == 200
    assert replayed_body["status"] == "replayed"
    assert replayed_body["metadata"]["cached"] is True


def test_generate_conflict_for_reused_key_with_different_payload(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="mock",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )

    first_payload = dict(valid_generate_payload)
    second_payload = dict(valid_generate_payload)
    second_payload["diagram_name"] = "Diagram BRD Demo v2"

    client.post(
        "/api/brd/generate",
        json=first_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-2"},
    )
    conflict_response = client.post(
        "/api/brd/generate",
        json=second_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-2"},
    )

    assert conflict_response.status_code == 409
    assert conflict_response.json()["error"]["code"] == "IDEMPOTENCY_KEY_CONFLICT"


def test_generate_returns_in_progress_when_same_key_is_still_running(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="mock",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )

    entry = IdempotencyEntry(
        key="idem-demo-3",
        payload_hash="same-hash",
        state="in_progress",
        response_body=None,
        status_code=None,
        created_at=utc_now(),
        expires_at=utc_now(),
    )

    def fake_begin(key: str, payload_hash: str):
        return "in_progress", entry

    monkeypatch.setattr(brd_generate.idempotency_store, "begin", fake_begin)

    response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-3"},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "in_progress"


def test_generate_provider_unavailable_without_openrouter_key(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )

    response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-4"},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PROVIDER_UNAVAILABLE"


def test_generate_can_retry_same_key_after_blocking_validation(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="mock",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )
    invalid_payload = dict(valid_generate_payload)
    invalid_payload["nodes"] = [node for node in invalid_payload["nodes"] if node["type"] != "end"]

    first_response = client.post(
        "/api/brd/generate",
        json=invalid_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-blocking"},
    )
    second_response = client.post(
        "/api/brd/generate",
        json=invalid_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-blocking"},
    )

    assert first_response.status_code == 422
    assert second_response.status_code == 422
    assert second_response.json()["status"] != "in_progress"


def test_generate_can_retry_same_key_after_provider_unavailable(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )

    first_response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-provider-unavailable"},
    )
    second_response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-provider-unavailable"},
    )

    assert first_response.status_code == 503
    assert second_response.status_code == 503
    assert second_response.json()["status"] != "in_progress"


def test_validate_rejects_missing_schema_version(client, valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)

    response = client.post("/api/brd/validate", json=payload)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SCHEMA_VERSION"


def test_generate_rejects_unsupported_schema_version(client, valid_generate_payload: dict) -> None:
    response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={"X-Schema-Version": "2026-01-01", "Idempotency-Key": "idem-demo-5"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SCHEMA_VERSION"


def test_validate_returns_429_when_rate_limited(client, monkeypatch, valid_generate_payload: dict) -> None:
    payload = dict(valid_generate_payload)
    payload.pop("template", None)
    monkeypatch.setattr(brd_validate.rate_limiter, "allow", lambda key: (False, 17))

    response = client.post("/api/brd/validate", json=payload, headers=SCHEMA_HEADERS)

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"


def test_generate_retries_retryable_provider_error_once(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="test-key",
        ),
    )

    calls = {"count": 0}

    class FakeProvider:
        def __init__(self, settings) -> None:
            self.settings = settings

        def generate_structured(self, system_prompt, user_content, response_schema, model):
            calls["count"] += 1
            if calls["count"] == 1:
                raise OpenRouterProviderError("timeout", retryable=True)
            return ProviderResult(
                output=response_schema.model_validate(
                    {
                        "metadata": {
                            "diagram_name": "Diagram BRD Demo",
                            "source_language": "vi",
                            "generated_language": "vi",
                            "generated_at": "2026-05-31T10:00:00Z",
                            "generator_model": model,
                            "generator_version": "fake-live-v1",
                        },
                        "summary": "Demo summary",
                        "actors": [
                            {"lane_id": "lane-a", "actor_name": "VOC", "responsibilities": []},
                            {
                                "lane_id": "lane-b",
                                "actor_name": "Nhân sự xử lý",
                                "responsibilities": [],
                            },
                        ],
                        "main_flow_steps": [
                            {
                                "step_id": "S01",
                                "node_id": "n-a1",
                                "actor_lane_id": "lane-a",
                                "actor_name": "VOC",
                                "description": "VOC thực hiện: Tiếp nhận yêu cầu",
                            }
                        ],
                        "branches": [],
                        "parallel_blocks": [],
                        "handoffs": [],
                        "loops": [],
                        "annotations": [],
                        "assumptions": [],
                        "open_questions": [],
                        "warnings": [],
                    }
                ),
                usage=ProviderUsage(estimated_cost_usd=0.12),
            )

    monkeypatch.setattr(brd_generate, "OpenRouterProvider", FakeProvider)

    response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-6"},
    )

    assert response.status_code == 200
    assert response.json()["metadata"]["attempt_count"] == 2
    assert response.json()["metadata"]["estimated_cost_usd"] == 0.12
    assert calls["count"] == 2


def test_generate_releases_idempotency_key_after_retryable_provider_failure(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="test-key",
        ),
    )

    calls = {"count": 0}

    class AlwaysFailProvider:
        def __init__(self, settings) -> None:
            self.settings = settings

        def generate_structured(self, system_prompt, user_content, response_schema, model):
            calls["count"] += 1
            raise OpenRouterProviderError("timeout", retryable=True)

    monkeypatch.setattr(brd_generate, "OpenRouterProvider", AlwaysFailProvider)

    first_response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-retryable-fail"},
    )
    second_response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-retryable-fail"},
    )

    assert first_response.status_code == 502
    assert second_response.status_code == 502
    assert second_response.json()["status"] != "in_progress"
    assert calls["count"] == 4


def test_generate_harmonizes_reader_facing_sections_from_live_provider(
    client, monkeypatch, valid_generate_payload: dict
) -> None:
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="test-key",
        ),
    )

    class RawIdHeavyProvider:
        def __init__(self, settings) -> None:
            self.settings = settings

        def generate_structured(self, system_prompt, user_content, response_schema, model):
            return ProviderResult(
                output=response_schema.model_validate(
                    {
                        "metadata": {
                            "diagram_name": "Diagram BRD Demo",
                            "source_language": "vi",
                            "generated_language": "vi",
                            "generated_at": "2026-05-31T10:00:00Z",
                            "generator_model": model,
                            "generator_version": "fake-live-v2",
                        },
                        "summary": "Demo summary",
                        "actors": [
                            {"lane_id": "lane-a", "actor_name": "lane-a", "responsibilities": []},
                            {"lane_id": "lane-b", "actor_name": "lane-b", "responsibilities": []},
                        ],
                        "main_flow_steps": [
                            {
                                "step_id": "S01",
                                "node_id": "n-a1",
                                "actor_lane_id": "lane-a",
                                "actor_name": "lane-a",
                                "description": "n-a1",
                            }
                        ],
                        "branches": [
                            {
                                "decision_node_id": "n-dec1",
                                "decision_text": "n-dec1",
                                "outcomes": [
                                    {
                                        "label": "Có",
                                        "target_node_id": "n-b1",
                                        "status": "labeled",
                                    }
                                ],
                            }
                        ],
                        "parallel_blocks": [],
                        "handoffs": [
                            {
                                "from_actor": "lane-a",
                                "to_actor": "lane-b",
                                "source_node_id": "n-a1",
                                "target_node_id": "n-b1",
                            }
                        ],
                        "loops": [],
                        "annotations": [],
                        "assumptions": ["n-b1"],
                        "open_questions": ["n-dec1"],
                        "warnings": [],
                    }
                ),
                usage=ProviderUsage(estimated_cost_usd=0.01),
            )

    monkeypatch.setattr(brd_generate, "OpenRouterProvider", RawIdHeavyProvider)

    response = client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": "idem-demo-7"},
    )

    assert response.status_code == 200
    markdown = response.json()["result"]["brd_markdown"]
    reader_facing_markdown, appendix = markdown.split("## Appendix A. Traceability (debug)")

    assert "Demo summary" not in reader_facing_markdown
    assert "Quy trình bắt đầu khi có tín hiệu hoặc yêu cầu đầu vào; sau đó VOC tiếp nhận và điều phối xử lý ban đầu." in reader_facing_markdown
    assert "lane-a" not in reader_facing_markdown
    assert "n-a1" not in reader_facing_markdown
    assert "n-dec1" not in reader_facing_markdown
    assert "VOC" in reader_facing_markdown
    assert "Tiếp nhận yêu cầu" in reader_facing_markdown
    assert "S01 -> n-a1" in appendix
