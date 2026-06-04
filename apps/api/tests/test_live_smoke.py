from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.rate_limit import InMemoryRateLimiter, parse_rate_limit
from app.routes import brd_generate, brd_validate

SCHEMA_HEADERS = {"X-Schema-Version": "2026-05-31"}
MAX_LIVE_COST_USD = 0.25


@pytest.fixture
def live_client(monkeypatch) -> TestClient:
    live_settings = Settings()
    if live_settings.provider != "openrouter" or not live_settings.openrouter_api_key:
        pytest.skip(
            "Live smoke skipped: set BRD_PROVIDER=openrouter and BRD_OPENROUTER_API_KEY in apps/api/.env."
        )

    monkeypatch.setattr(brd_generate, "settings", live_settings)
    monkeypatch.setattr(brd_validate, "settings", live_settings)
    monkeypatch.setattr(
        brd_generate,
        "rate_limiter",
        InMemoryRateLimiter(parse_rate_limit(live_settings.request_rate_limit)),
    )
    monkeypatch.setattr(
        brd_validate,
        "rate_limiter",
        InMemoryRateLimiter(parse_rate_limit(live_settings.request_rate_limit)),
    )
    brd_generate.idempotency_store._entries.clear()

    with TestClient(app) as test_client:
        yield test_client

    brd_generate.idempotency_store._entries.clear()


@pytest.fixture
def valid_generate_payload() -> dict:
    return {
        "diagram_name": "Diagram BRD Live Smoke",
        "language": "vi",
        "template": "default",
        "lanes": [
            {"id": "lane-a", "title": "VOC", "order": 0},
            {"id": "lane-b", "title": "Nhan su xu ly", "order": 1},
        ],
        "nodes": [
            {"id": "n-start", "type": "start", "x": 120, "y": 120},
            {
                "id": "n-a1",
                "type": "activity",
                "lane_id": "lane-a",
                "text": "Tiep nhan yeu cau",
                "x": 200,
                "y": 220,
            },
            {
                "id": "n-dec1",
                "type": "decision",
                "lane_id": "lane-a",
                "text": "Du thong tin?",
                "x": 200,
                "y": 340,
            },
            {
                "id": "n-b1",
                "type": "activity",
                "lane_id": "lane-b",
                "text": "Xu ly yeu cau",
                "x": 520,
                "y": 460,
            },
            {"id": "n-end", "type": "end", "x": 520, "y": 620},
        ],
        "edges": [
            {"id": "e1", "source_node_id": "n-start", "target_node_id": "n-a1"},
            {"id": "e2", "source_node_id": "n-a1", "target_node_id": "n-dec1"},
            {
                "id": "e3",
                "source_node_id": "n-dec1",
                "target_node_id": "n-b1",
                "label": "Co",
            },
            {"id": "e4", "source_node_id": "n-b1", "target_node_id": "n-end"},
        ],
    }


def make_idempotency_key() -> str:
    return f"live-smoke-{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}"


def test_generate_live_happy_path(live_client: TestClient, valid_generate_payload: dict) -> None:
    response = live_client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": make_idempotency_key()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["result"]["brd_markdown"]
    assert payload["metadata"]["provider"] == "openrouter"
    assert payload["metadata"]["attempt_count"] >= 1
    estimated_cost = payload["metadata"].get("estimated_cost_usd")
    if estimated_cost is not None:
        assert estimated_cost <= MAX_LIVE_COST_USD


def test_generate_live_replays_same_idempotency_key(
    live_client: TestClient, valid_generate_payload: dict
) -> None:
    key = make_idempotency_key()

    first = live_client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": key},
    )
    second = live_client.post(
        "/api/brd/generate",
        json=valid_generate_payload,
        headers={**SCHEMA_HEADERS, "Idempotency-Key": key},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "replayed"
    assert second.json()["metadata"]["cached"] is True
