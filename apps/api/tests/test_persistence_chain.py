from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.auth import CurrentUser, require_current_user
from app.db import get_session_factory
from app.main import app
from app.models import AppUser, BrdDoc, Diagram, FeatureIntentModel, Project, Spec, UseCaseModel
from app.routes import brd_generate
from app.providers.openrouter_provider import OpenRouterProviderError


def clear_persistence_tables() -> None:
    with get_session_factory()() as db:
        for model in (BrdDoc, Diagram, UseCaseModel, FeatureIntentModel, Spec, Project, AppUser):
            db.execute(delete(model))
        db.commit()


def create_persisted_chain(client: TestClient) -> tuple[str, str, str, str]:
    project = client.post(
        "/api/projects",
        json={"name": "V-PetSafe", "description": "Pet safety operations"},
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    spec = client.put(
        f"/api/projects/{project_id}/spec",
        json={
            "project_summary": "Điều phối quy trình tìm thú cưng thất lạc.",
            "business_context": "Kết nối cư dân và đội vận hành.",
            "target_users": ["Cư dân", "Điều phối viên"],
            "business_rules": ["Mọi cảnh báo phải có vị trí."],
            "glossary": ["VOC: Trung tâm vận hành"],
        },
    )
    assert spec.status_code == 200
    spec_id = spec.json()["id"]

    feature = client.post(
        f"/api/specs/{spec_id}/feature-intents",
        json={
            "name": "Báo mất thú cưng",
            "feature_summary": "Tiếp nhận và điều phối cảnh báo.",
            "actors": ["Cư dân", "Điều phối viên"],
            "trigger": "Cư dân gửi cảnh báo",
            "inputs": ["Thông tin thú cưng", "Vị trí"],
            "outputs": ["Cảnh báo được điều phối"],
            "constraints": [],
            "assumptions": [],
            "systems_involved": ["V-PetSafe"],
            "success_outcome": "Đội vận hành tiếp nhận cảnh báo.",
        },
    )
    assert feature.status_code == 201
    feature_id = feature.json()["id"]

    generated = client.post(
        f"/api/feature-intents/{feature_id}/use-cases/generate",
        params={"generation_preference": "deterministic"},
    )
    assert generated.status_code == 200
    generated_payload = generated.json()
    assert generated_payload["request_id"].startswith("req_")
    draft = generated_payload["result"]["use_cases"][0]
    draft["review_status"] = "approved"

    saved_use_cases = client.put(
        f"/api/feature-intents/{feature_id}/use-cases",
        json={"items": [{"id": None, "content": draft}]},
    )
    assert saved_use_cases.status_code == 200
    use_case = saved_use_cases.json()[0]
    use_case_id = use_case["id"]

    generated_diagram = client.post(f"/api/use-cases/{use_case_id}/diagram/generate")
    assert generated_diagram.status_code == 200
    diagram_draft = generated_diagram.json()["result"]["diagram"]
    lanes = [
        {"id": lane["id"], "title": lane["title"], "order": lane["order"], "width": lane["width"]}
        for lane in diagram_draft["lanes"]
    ]
    graph = {
        "nodes": [
            {
                "id": node["id"],
                "type": node["type"],
                "x": node["x"],
                "y": node["y"],
                "text": node["text"],
                "properties": {
                    **node["properties"],
                    "laneId": node.get("lane_id"),
                },
            }
            for node in diagram_draft["nodes"]
        ],
        "edges": [
            {
                "id": edge["id"],
                "type": "polyline",
                "sourceNodeId": edge["source_node_id"],
                "targetNodeId": edge["target_node_id"],
                "text": edge.get("label"),
                "properties": {},
            }
            for edge in diagram_draft["edges"]
        ],
    }
    saved_diagram = client.put(
        f"/api/use-cases/{use_case_id}/diagram",
        json={
            "title": diagram_draft["title"],
            "graph_data": graph,
            "lanes_data": lanes,
            "lane_height": 900,
            "semantic_edited": False,
        },
    )
    assert saved_diagram.status_code == 200
    diagram_id = saved_diagram.json()["id"]
    return project_id, feature_id, use_case_id, diagram_id


def test_latest_state_chain_and_owner_isolation(client: TestClient, monkeypatch) -> None:
    clear_persistence_tables()
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="",
        ),
    )
    project_id, _feature_id, use_case_id, diagram_id = create_persisted_chain(client)

    generated_brd = client.post(
        f"/api/diagrams/{diagram_id}/brd/generate",
        headers={"Idempotency-Key": "persistence-chain-test"},
    )
    assert generated_brd.status_code == 200
    assert generated_brd.json()["metadata"]["generation_source"] == "deterministic_fallback"
    assert (
        generated_brd.json()["metadata"]["fallback_reason"] == "provider_unavailable_config"
    )
    brd_result = generated_brd.json()["result"]

    saved_brd = client.put(
        f"/api/diagrams/{diagram_id}/brd",
        json={
            "title": "V-PetSafe BRD",
            "structured_spec": brd_result["spec"],
            "markdown_content": brd_result["brd_markdown"],
            "warnings": generated_brd.json()["warnings"],
            "template": "default",
        },
    )
    assert saved_brd.status_code == 200
    assert client.get(f"/api/diagrams/{diagram_id}/brd").json()["markdown_content"]

    other_id = UUID("00000000-0000-0000-0000-000000000002")
    with get_session_factory()() as db:
        db.add(
            AppUser(
                id=other_id,
                clerk_user_id="other_test_user",
                email="other@example.com",
                role="user",
            )
        )
        db.commit()

    app.dependency_overrides[require_current_user] = lambda: CurrentUser(
        id=other_id,
        clerk_user_id="other_test_user",
        role="user",
    )
    try:
        assert client.get(f"/api/projects/{project_id}").status_code == 404
        assert client.get(f"/api/use-cases/{use_case_id}/diagram").status_code == 404
    finally:
        app.dependency_overrides.pop(require_current_user, None)
        clear_persistence_tables()


def test_saved_brd_generation_falls_back_when_provider_request_fails(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_persistence_tables()
    monkeypatch.setattr(
        brd_generate,
        "settings",
        SimpleNamespace(
            provider="openrouter",
            model_primary="openai/gpt-5.5",
            openrouter_api_key="configured",
        ),
    )

    class FailingProvider:
        def generate_structured(self, *_args, **_kwargs):
            raise OpenRouterProviderError("Transient provider issue.", retryable=True)

    monkeypatch.setattr(brd_generate, "build_provider", lambda *_args, **_kwargs: FailingProvider())
    _project_id, _feature_id, _use_case_id, diagram_id = create_persisted_chain(client)

    generated_brd = client.post(
        f"/api/diagrams/{diagram_id}/brd/generate",
        headers={"Idempotency-Key": "provider-request-failed-test"},
    )

    assert generated_brd.status_code == 200
    assert generated_brd.json()["metadata"]["generation_source"] == "deterministic_fallback"
    assert generated_brd.json()["metadata"]["fallback_reason"] == "provider_request_failed"
    clear_persistence_tables()
