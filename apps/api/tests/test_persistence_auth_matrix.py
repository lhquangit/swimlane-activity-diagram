from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import get_session_factory
from app.main import app
from app.models import AppUser, BrdDoc, Diagram, FeatureIntentModel, Project, Spec, UseCaseModel


@dataclass(frozen=True)
class FakeAuthSettings:
    auth_disabled: bool = False
    clerk_secret_key: str = "test_secret"
    clerk_jwt_key: str = ""
    clerk_authorized_parties: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.clerk_authorized_parties is None:
            object.__setattr__(self, "clerk_authorized_parties", ["http://127.0.0.1:4173"])


class FakeAuthState:
    def __init__(self, is_signed_in: bool, payload: dict[str, object] | None = None) -> None:
        self.is_signed_in = is_signed_in
        self.payload = payload


def clear_tables() -> None:
    with get_session_factory()() as db:
        for model in (BrdDoc, Diagram, UseCaseModel, FeatureIntentModel, Spec, Project, AppUser):
            db.execute(delete(model))
        db.commit()


def install_fake_clerk(monkeypatch) -> None:
    import app.auth as auth

    def fake_authenticate(request):
        token = request.headers.get("authorization", "")
        if not token:
            return FakeAuthState(False)
        if token == "Bearer invalid":
            return FakeAuthState(False)
        if token == "Bearer missing-sub":
            return FakeAuthState(True, {"email": "missing@example.com"})
        if token == "Bearer wrong-party":
            return FakeAuthState(False)
        subject = token.removeprefix("Bearer ").strip()
        return FakeAuthState(
            True,
            {
                "sub": subject,
                "email": f"{subject}@example.com",
                "name": f"{subject} User",
                "role": "admin",
            },
        )

    monkeypatch.setattr(auth, "get_auth_settings", lambda: FakeAuthSettings())
    monkeypatch.setattr(auth, "authenticate_clerk_request", fake_authenticate)


def auth_headers(subject: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {subject}"}


def create_project_chain(client: TestClient, subject: str = "user_a") -> dict[str, Any]:
    headers = auth_headers(subject)
    project = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "V-PetSafe", "description": "Pet safety operations"},
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    spec = client.put(
        f"/api/projects/{project_id}/spec",
        headers=headers,
        json={
            "project_summary": "Điều phối tìm thú cưng thất lạc.",
            "business_context": "Kết nối cư dân và đội vận hành.",
            "target_users": ["Cư dân"],
            "business_rules": ["Mọi cảnh báo phải có vị trí."],
            "glossary": [],
        },
    )
    assert spec.status_code == 200
    spec_id = spec.json()["id"]

    feature = client.post(
        f"/api/specs/{spec_id}/feature-intents",
        headers=headers,
        json={
            "name": "Báo mất thú cưng",
            "feature_summary": "Tiếp nhận và điều phối cảnh báo.",
            "actors": ["Cư dân", "Điều phối viên"],
            "trigger": "Cư dân gửi cảnh báo",
            "inputs": ["Thông tin thú cưng"],
            "outputs": ["Cảnh báo"],
            "constraints": [],
            "assumptions": [],
            "systems_involved": ["V-PetSafe"],
            "success_outcome": "Đội vận hành tiếp nhận.",
        },
    )
    assert feature.status_code == 201
    feature_id = feature.json()["id"]

    generated = client.post(
        f"/api/feature-intents/{feature_id}/use-cases/generate",
        headers=headers,
        params={"generation_preference": "deterministic"},
    )
    assert generated.status_code == 200
    draft = generated.json()["result"]["use_cases"][0]
    draft["review_status"] = "approved"

    saved_use_cases = client.put(
        f"/api/feature-intents/{feature_id}/use-cases",
        headers=headers,
        json={"items": [{"id": None, "content": draft}]},
    )
    assert saved_use_cases.status_code == 200
    use_case_id = saved_use_cases.json()[0]["id"]

    diagram = client.put(
        f"/api/use-cases/{use_case_id}/diagram",
        headers=headers,
        json=valid_diagram_payload(),
    )
    assert diagram.status_code == 200
    diagram_id = diagram.json()["id"]

    brd = client.put(
        f"/api/diagrams/{diagram_id}/brd",
        headers=headers,
        json={
            "title": "V-PetSafe BRD",
            "structured_spec": {"metadata": {"diagram_name": "Báo mất thú cưng"}},
            "markdown_content": "# BRD\n\nNội dung.",
            "warnings": [],
            "template": "default",
        },
    )
    assert brd.status_code == 200

    return {
        "project_id": project_id,
        "spec_id": spec_id,
        "feature_id": feature_id,
        "use_case_id": use_case_id,
        "diagram_id": diagram_id,
        "brd_id": brd.json()["id"],
    }


def valid_diagram_payload() -> dict[str, Any]:
    return {
        "title": "Báo mất thú cưng",
        "lanes_data": [{"id": "lane-citizen", "title": "Cư dân", "order": 0, "width": 360}],
        "lane_height": 900,
        "semantic_edited": False,
        "graph_data": {
            "nodes": [
                {"id": "start", "type": "start", "x": 100, "y": 120, "text": "Start", "properties": {}},
                {
                    "id": "activity-1",
                    "type": "activity",
                    "x": 240,
                    "y": 220,
                    "text": {"value": "Gửi cảnh báo"},
                    "properties": {"laneId": "lane-citizen"},
                },
                {"id": "end", "type": "end", "x": 420, "y": 320, "text": "End", "properties": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "start", "targetNodeId": "activity-1", "properties": {}},
                {"id": "e2", "sourceNodeId": "activity-1", "targetNodeId": "end", "properties": {}},
            ],
        },
    }


def test_clerk_auth_rejects_missing_invalid_and_subjectless_tokens(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    try:
        assert client.get("/api/projects").status_code == 401
        assert client.get("/api/projects", headers={"Authorization": "Bearer invalid"}).status_code == 401
        assert client.get("/api/projects", headers={"Authorization": "Bearer wrong-party"}).status_code == 401
        response = client.get("/api/projects", headers={"Authorization": "Bearer missing-sub"})
        assert response.status_code == 401
        assert "subject" in response.json()["detail"]
    finally:
        clear_tables()


def test_new_clerk_user_is_hydrated_as_role_user(client: TestClient, monkeypatch) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    try:
        response = client.get("/api/me", headers=auth_headers("new_user"))
        assert response.status_code == 200
        payload = response.json()
        assert payload["clerk_user_id"] == "new_user"
        assert payload["role"] == "user"
    finally:
        clear_tables()


def test_cross_user_access_returns_404_for_full_resource_chain(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        other = auth_headers("user_b")
        assert client.get(f"/api/projects/{ids['project_id']}", headers=other).status_code == 404
        assert client.get(f"/api/projects/{ids['project_id']}/spec", headers=other).status_code == 404
        assert client.get(f"/api/feature-intents/{ids['feature_id']}", headers=other).status_code == 404
        assert client.delete(f"/api/use-cases/{ids['use_case_id']}", headers=other).status_code == 404
        assert client.get(f"/api/diagrams/{ids['diagram_id']}/brd", headers=other).status_code == 404
        assert client.delete(f"/api/diagrams/{ids['diagram_id']}/brd", headers=other).status_code == 404
    finally:
        clear_tables()


def test_use_case_generation_does_not_auto_save(client: TestClient, monkeypatch) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        response = client.post(
            f"/api/feature-intents/{ids['feature_id']}/use-cases/generate",
            headers=auth_headers("user_a"),
            params={"generation_preference": "deterministic"},
        )
        assert response.status_code == 200
        listed = client.get(
            f"/api/feature-intents/{ids['feature_id']}/use-cases",
            headers=auth_headers("user_a"),
        )
        assert listed.status_code == 200
        assert len(listed.json()) == 1
    finally:
        clear_tables()


def test_malformed_diagram_payload_is_rejected_before_save(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        payload = valid_diagram_payload()
        payload["graph_data"]["edges"][0]["targetNodeId"] = "missing-node"
        response = client.put(
            f"/api/use-cases/{ids['use_case_id']}/diagram",
            headers=auth_headers("user_a"),
            json=payload,
        )
        assert response.status_code == 422
    finally:
        clear_tables()


def test_delete_use_case_cascades_diagram_and_brd(client: TestClient, monkeypatch) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        headers = auth_headers("user_a")
        assert client.delete(f"/api/use-cases/{ids['use_case_id']}", headers=headers).status_code == 204
        assert client.get(f"/api/diagrams/{ids['diagram_id']}/brd", headers=headers).status_code == 404
        listed = client.get(
            f"/api/feature-intents/{ids['feature_id']}/use-cases",
            headers=headers,
        )
        assert listed.status_code == 200
        assert listed.json() == []
    finally:
        clear_tables()
