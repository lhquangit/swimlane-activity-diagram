from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routes import brd_generate


@pytest.fixture(autouse=True)
def reset_idempotency_store() -> Iterator[None]:
    brd_generate.idempotency_store._entries.clear()
    yield
    brd_generate.idempotency_store._entries.clear()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def valid_generate_payload() -> dict:
    return {
        "diagram_name": "Diagram BRD Demo",
        "language": "vi",
        "template": "default",
        "lanes": [
            {"id": "lane-a", "title": "VOC", "order": 0},
            {"id": "lane-b", "title": "Nhân sự xử lý", "order": 1},
        ],
        "nodes": [
            {"id": "n-start", "type": "start", "x": 120, "y": 120},
            {
                "id": "n-a1",
                "type": "activity",
                "lane_id": "lane-a",
                "text": "Tiếp nhận yêu cầu",
                "x": 200,
                "y": 220,
            },
            {
                "id": "n-dec1",
                "type": "decision",
                "lane_id": "lane-a",
                "text": "Đủ thông tin?",
                "x": 200,
                "y": 340,
            },
            {
                "id": "n-b1",
                "type": "activity",
                "lane_id": "lane-b",
                "text": "Xử lý yêu cầu",
                "x": 520,
                "y": 460,
            },
            {
                "id": "n-note",
                "type": "note",
                "lane_id": "lane-b",
                "text": "Cần xác nhận BA",
                "x": 540,
                "y": 510,
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
                "label": "Có",
            },
            {"id": "e4", "source_node_id": "n-dec1", "target_node_id": "n-end"},
            {"id": "e5", "source_node_id": "n-b1", "target_node_id": "n-end"},
        ],
    }
