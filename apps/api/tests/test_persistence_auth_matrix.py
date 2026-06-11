from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import get_session_factory
from app.main import app
from app.models import AppUser, BrdDoc, Diagram, FeatureIntentModel, Project, Spec, UseCaseModel
from app.schemas.common import ResponseMetadata
from app.schemas.usecase import FeatureIntent, ProjectSpec, UseCaseDraft
from app.services import persistence_generation, persistence_serializers
from app.usecases.generation_service import GenerationOutcome


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


def install_mock_usecase_generation(monkeypatch) -> None:
    class FakeGenerationService:
        def generate(
            self,
            project_spec: ProjectSpec,
            feature_intent: FeatureIntent,
            preference: str = "ai",
        ) -> GenerationOutcome:
            primary_actor = feature_intent.primary_actor or feature_intent.actors[0]
            supporting = [actor for actor in feature_intent.actors if actor != primary_actor]
            trigger = feature_intent.trigger or feature_intent.inputs[0] if feature_intent.inputs else None
            draft = UseCaseDraft(
                use_case_id="UC-AI-001",
                title=f"{primary_actor} xử lý {feature_intent.feature_name}",
                objective=feature_intent.feature_summary,
                primary_actor=primary_actor,
                supporting_actors=supporting,
                preconditions=[f"Feature {feature_intent.feature_name} đã sẵn sàng để xử lý."],
                happy_path_summary=[feature_intent.feature_summary],
                key_exceptions=[],
                main_flow_steps=[
                    {
                        "step_id": "UC-AI-001-S01",
                        "actor_ref": primary_actor,
                        "action": f"Tiếp nhận và xử lý {feature_intent.feature_name}",
                        "input_or_trigger": trigger,
                        "expected_result": feature_intent.success_outcome or "Yêu cầu được xử lý.",
                    }
                ],
                alternate_flows=[],
                success_outcome=feature_intent.success_outcome or "Yêu cầu được xử lý.",
                review_status="draft",
            )
            return GenerationOutcome(
                use_cases=[draft],
                metadata=ResponseMetadata(
                    capability="usecase_synthesis",
                    provider="openrouter",
                    model="mock/usecase-model",
                    generation_source="ai",
                    generation_mode="ai_default",
                    prompt_id="usecase_synthesis",
                    prompt_version="1.2.0",
                    quality_status="passed",
                    attempt_count=1,
                ),
                warnings=[],
            )

    monkeypatch.setattr(persistence_generation, "generation_service", FakeGenerationService())
    monkeypatch.setattr(
        persistence_serializers,
        "settings",
        type(
            "RuntimeSettings",
            (),
            {
                "usecase_provider": "openrouter",
                "usecase_generation_mode": "ai_default",
                "usecase_prompt_version": "1.2.0",
                "ai_openrouter_api_key": "sk-test",
                "openrouter_api_key": "sk-test",
            },
        )(),
    )


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
        params={"generation_preference": "ai"},
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
    install_mock_usecase_generation(monkeypatch)
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
    install_mock_usecase_generation(monkeypatch)
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
    install_mock_usecase_generation(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        other = auth_headers("user_b")
        assert client.get(f"/api/projects/{ids['project_id']}", headers=other).status_code == 404
        assert (
            client.get(
                f"/api/projects/{ids['project_id']}/artifact-tree",
                headers=other,
            ).status_code
            == 404
        )
        assert client.get(f"/api/projects/{ids['project_id']}/spec", headers=other).status_code == 404
        assert client.get(f"/api/feature-intents/{ids['feature_id']}", headers=other).status_code == 404
        assert client.delete(f"/api/use-cases/{ids['use_case_id']}", headers=other).status_code == 404
        assert client.get(f"/api/diagrams/{ids['diagram_id']}/brd", headers=other).status_code == 404
        assert client.delete(f"/api/diagrams/{ids['diagram_id']}/brd", headers=other).status_code == 404
    finally:
        clear_tables()


def test_project_artifact_tree_returns_owned_metadata_without_heavy_payloads(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    install_mock_usecase_generation(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        response = client.get(
            f"/api/projects/{ids['project_id']}/artifact-tree",
            headers=auth_headers("user_a"),
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["project"]["id"] == ids["project_id"]
        assert payload["spec"]["id"] == ids["spec_id"]
        assert len(payload["features"]) == 1

        feature = payload["features"][0]
        assert feature["id"] == ids["feature_id"]
        assert len(feature["use_cases"]) == 1

        use_case = feature["use_cases"][0]
        assert use_case["id"] == ids["use_case_id"]
        assert use_case["diagram"]["id"] == ids["diagram_id"]
        assert use_case["diagram"]["brd"]["id"] == ids["brd_id"]
        assert "graph_data" not in use_case["diagram"]
        assert "lanes_data" not in use_case["diagram"]
        assert "structured_spec" not in use_case["diagram"]["brd"]
        assert "markdown_content" not in use_case["diagram"]["brd"]
    finally:
        clear_tables()


def test_feature_resources_persist_latest_usecase_generation_metadata(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    install_mock_usecase_generation(monkeypatch)
    try:
        headers = auth_headers("user_a")
        project = client.post(
            "/api/projects",
            headers=headers,
            json={"name": "AI Camera", "description": "Re-identification workspace"},
        )
        assert project.status_code == 201
        project_id = project.json()["id"]

        spec = client.put(
            f"/api/projects/{project_id}/spec",
            headers=headers,
            json={
                "project_summary": "Theo dõi camera và AI re-id.",
                "business_context": "Cần rà soát sự kiện từ camera.",
                "target_users": ["Ban quản lý"],
                "business_rules": [],
                "glossary": [],
            },
        )
        assert spec.status_code == 200
        spec_id = spec.json()["id"]

        feature = client.post(
            f"/api/specs/{spec_id}/feature-intents",
            headers=headers,
            json={
                "name": "Re-ID camera",
                "feature_summary": "Nhận diện lại đối tượng từ camera và dịch vụ AI.",
                "actors": ["Ban quản lý", "Camera AI", "Dịch vụ Re-ID"],
                "trigger": "Camera phát hiện đối tượng quan tâm",
                "inputs": ["Ảnh camera"],
                "outputs": ["Kết quả nhận diện"],
                "constraints": [],
                "assumptions": [],
                "systems_involved": ["Dịch vụ Re-ID"],
                "success_outcome": "Ban quản lý nhận được đối tượng đã đối sánh.",
            },
        )
        assert feature.status_code == 201
        feature_id = feature.json()["id"]

        generated = client.post(
            f"/api/feature-intents/{feature_id}/use-cases/generate",
            headers=headers,
            params={"generation_preference": "ai"},
        )
        assert generated.status_code == 200
        generated_payload = generated.json()

        feature_response = client.get(f"/api/feature-intents/{feature_id}", headers=headers)
        assert feature_response.status_code == 200
        feature_payload = feature_response.json()
        assert feature_payload["latest_usecase_generation"] is None
        assert feature_payload["usecase_generation_runtime"] is not None
        assert feature_payload["usecase_generation_runtime"]["status"] == "available"
        assert feature_payload["usecase_generation_runtime"]["can_generate"] is True
        assert feature_payload["usecase_generation_runtime"]["note"]

        save_use_cases = client.put(
            f"/api/feature-intents/{feature_id}/use-cases",
            headers=headers,
            json={
                "items": [
                    {"id": None, "content": item}
                    for item in generated_payload["result"]["use_cases"]
                ],
                "committed_generation_metadata": generated_payload["metadata"],
            },
        )
        assert save_use_cases.status_code == 200

        committed_feature_response = client.get(
            f"/api/feature-intents/{feature_id}",
            headers=headers,
        )
        assert committed_feature_response.status_code == 200
        committed_feature_payload = committed_feature_response.json()
        assert committed_feature_payload["latest_usecase_generation"]["generation_source"] == "ai"

        list_response = client.get(f"/api/specs/{spec_id}/feature-intents", headers=headers)
        assert list_response.status_code == 200
        listed_feature = next(item for item in list_response.json() if item["id"] == feature_id)
        assert listed_feature["latest_usecase_generation"]["generation_source"] == "ai"
        assert listed_feature["usecase_generation_runtime"] is not None
        assert listed_feature["usecase_generation_runtime"]["status"] == "available"
        assert listed_feature["usecase_generation_runtime"]["can_generate"] is True
        assert listed_feature["latest_usecase_generation"]["provider"] == "openrouter"
        assert listed_feature["latest_usecase_generation"]["model"] == "mock/usecase-model"
    finally:
        clear_tables()


def test_bulk_use_case_save_replaces_omitted_rows_and_rekeys_retained_row(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    install_mock_usecase_generation(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        headers = auth_headers("user_a")
        saved_use_cases = client.get(
            f"/api/feature-intents/{ids['feature_id']}/use-cases",
            headers=headers,
        )
        assert saved_use_cases.status_code == 200
        original = saved_use_cases.json()[0]

        second_draft = deepcopy(original["content"])
        second_draft["use_case_id"] = "UC-SECOND"
        second_draft["title"] = "Theo doi canh bao"
        second_draft["main_flow_steps"][0]["step_id"] = "UC-SECOND-S01"
        second_draft["main_flow_steps"][0]["action"] = "Theo doi canh bao"

        expanded = client.put(
            f"/api/feature-intents/{ids['feature_id']}/use-cases",
            headers=headers,
            json={
                "items": [
                    {"id": original["id"], "content": original["content"]},
                    {"id": None, "content": second_draft},
                ]
            },
        )
        assert expanded.status_code == 200
        expanded_payload = expanded.json()
        assert len(expanded_payload) == 2
        second_saved = next(
            item for item in expanded_payload if item["use_case_key"] == "UC-SECOND"
        )

        replacement = deepcopy(second_draft)
        replacement["use_case_id"] = "UC-SECOND-REKEYED"
        replacement["title"] = "Theo doi canh bao da cap nhat"
        replacement["main_flow_steps"][0]["step_id"] = "UC-SECOND-REKEYED-S01"

        replaced = client.put(
            f"/api/feature-intents/{ids['feature_id']}/use-cases",
            headers=headers,
            json={"items": [{"id": second_saved["id"], "content": replacement}]},
        )
        assert replaced.status_code == 200
        replaced_payload = replaced.json()
        assert len(replaced_payload) == 1
        assert replaced_payload[0]["id"] == second_saved["id"]
        assert replaced_payload[0]["use_case_key"] == "UC-SECOND-REKEYED"

        tree = client.get(
            f"/api/projects/{ids['project_id']}/artifact-tree",
            headers=headers,
        )
        assert tree.status_code == 200
        use_cases = tree.json()["features"][0]["use_cases"]
        assert [item["use_case_key"] for item in use_cases] == ["UC-SECOND-REKEYED"]
        assert use_cases[0]["diagram"] is None

        with get_session_factory()() as db:
            assert db.get(UseCaseModel, ids["use_case_id"]) is None
            assert db.get(Diagram, ids["diagram_id"]) is None
            assert db.get(BrdDoc, ids["brd_id"]) is None
            assert db.get(UseCaseModel, second_saved["id"]) is not None
            assert db.query(UseCaseModel).count() == 1
            assert db.query(Diagram).count() == 0
            assert db.query(BrdDoc).count() == 0
    finally:
        clear_tables()


def test_project_artifact_tree_supports_empty_and_partial_chains(
    client: TestClient,
    monkeypatch,
) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    install_mock_usecase_generation(monkeypatch)
    try:
        headers = auth_headers("user_a")
        project = client.post(
            "/api/projects",
            headers=headers,
            json={"name": "Empty project", "description": None},
        )
        assert project.status_code == 201

        empty_tree = client.get(
            f"/api/projects/{project.json()['id']}/artifact-tree",
            headers=headers,
        )
        assert empty_tree.status_code == 200
        assert empty_tree.json()["features"] == []

        spec_id = empty_tree.json()["spec"]["id"]
        feature = client.post(
            f"/api/specs/{spec_id}/feature-intents",
            headers=headers,
            json={
                "name": "Feature without children",
                "feature_summary": "Persisted feature only.",
                "actors": [],
                "trigger": None,
                "inputs": [],
                "outputs": [],
                "constraints": [],
                "assumptions": [],
                "systems_involved": [],
                "success_outcome": None,
            },
        )
        assert feature.status_code == 201

        partial_tree = client.get(
            f"/api/projects/{project.json()['id']}/artifact-tree",
            headers=headers,
        )
        assert partial_tree.status_code == 200
        assert partial_tree.json()["features"][0]["use_cases"] == []
    finally:
        clear_tables()


def test_use_case_generation_does_not_auto_save(client: TestClient, monkeypatch) -> None:
    clear_tables()
    install_fake_clerk(monkeypatch)
    install_mock_usecase_generation(monkeypatch)
    try:
        ids = create_project_chain(client, "user_a")
        response = client.post(
            f"/api/feature-intents/{ids['feature_id']}/use-cases/generate",
            headers=auth_headers("user_a"),
            params={"generation_preference": "ai"},
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
    install_mock_usecase_generation(monkeypatch)
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
    install_mock_usecase_generation(monkeypatch)
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
