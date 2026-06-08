from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.auth import CurrentUser, require_current_user
from app.db import get_db
from app.models import AppUser
from app.persistence import require_diagram, require_feature, require_use_case
from app.routes.brd_generate import generate_brd
from app.routes.brd_validate import validate_brd_request
from app.runtime_contract import json_response_from_envelope
from app.schemas.persistence import (
    AppUserResource,
    BrdResource,
    BrdSave,
    DiagramResource,
    DiagramSave,
    FeatureIntentCreate,
    FeatureIntentResource,
    FeatureIntentUpdate,
    ProjectCreate,
    ProjectArtifactTree,
    ProjectResource,
    ProjectUpdate,
    SpecResource,
    SpecUpdate,
    UseCaseBulkSave,
    UseCaseResource,
)
from app.services.persistence_generation import (
    generate_feature_use_case_envelope,
    generate_use_case_diagram_envelope,
    stored_generate_request,
)
from app.services.persistence_serializers import app_user_resource
from app.services.persistence_service import (
    create_owned_feature,
    create_owned_project,
    delete_owned_brd,
    delete_owned_diagram,
    delete_owned_feature,
    delete_owned_project,
    delete_owned_use_case,
    get_owned_brd,
    get_owned_feature,
    get_owned_project,
    get_owned_project_artifact_tree,
    get_owned_project_spec,
    get_owned_use_case_diagram,
    list_owned_features,
    list_owned_projects,
    list_owned_use_cases,
    save_owned_brd,
    save_owned_diagram,
    save_owned_use_cases,
    update_owned_feature,
    update_owned_project,
    update_owned_project_spec,
)

router = APIRouter(prefix="/api")


@router.get("/me", response_model=AppUserResource)
def get_me(
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> AppUserResource:
    user = db.get(AppUser, current_user.id)
    if user is None:
        raise RuntimeError("Authenticated app_user was not hydrated.")
    return app_user_resource(user)


@router.get("/projects", response_model=list[ProjectResource])
def list_projects(
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectResource]:
    return list_owned_projects(db, current_user)


@router.post("/projects", response_model=ProjectResource, status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ProjectResource:
    return create_owned_project(db, current_user, payload)


@router.get("/projects/{project_id}", response_model=ProjectResource)
def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ProjectResource:
    return get_owned_project(db, current_user, project_id)


@router.get("/projects/{project_id}/artifact-tree", response_model=ProjectArtifactTree)
def get_project_artifact_tree(
    project_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ProjectArtifactTree:
    return get_owned_project_artifact_tree(db, current_user, project_id)


@router.put("/projects/{project_id}", response_model=ProjectResource)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ProjectResource:
    return update_owned_project(db, current_user, project_id, payload)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    delete_owned_project(db, current_user, project_id)
    return Response(status_code=204)


@router.get("/projects/{project_id}/spec", response_model=SpecResource)
def get_project_spec(
    project_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> SpecResource:
    return get_owned_project_spec(db, current_user, project_id)


@router.put("/projects/{project_id}/spec", response_model=SpecResource)
def update_project_spec(
    project_id: UUID,
    payload: SpecUpdate,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> SpecResource:
    return update_owned_project_spec(db, current_user, project_id, payload)


@router.get("/specs/{spec_id}/feature-intents", response_model=list[FeatureIntentResource])
def list_features(
    spec_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[FeatureIntentResource]:
    return list_owned_features(db, current_user, spec_id)


@router.post(
    "/specs/{spec_id}/feature-intents",
    response_model=FeatureIntentResource,
    status_code=201,
)
def create_feature(
    spec_id: UUID,
    payload: FeatureIntentCreate,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> FeatureIntentResource:
    return create_owned_feature(db, current_user, spec_id, payload)


@router.get("/feature-intents/{feature_id}", response_model=FeatureIntentResource)
def get_feature(
    feature_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> FeatureIntentResource:
    return get_owned_feature(db, current_user, feature_id)


@router.put("/feature-intents/{feature_id}", response_model=FeatureIntentResource)
def update_feature(
    feature_id: UUID,
    payload: FeatureIntentUpdate,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> FeatureIntentResource:
    return update_owned_feature(db, current_user, feature_id, payload)


@router.delete("/feature-intents/{feature_id}", status_code=204)
def delete_feature(
    feature_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    delete_owned_feature(db, current_user, feature_id)
    return Response(status_code=204)


@router.post("/feature-intents/{feature_id}/use-cases/generate")
def generate_feature_use_cases(
    feature_id: UUID,
    generation_preference: str = "auto",
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> object:
    feature = require_feature(db, current_user, feature_id)
    envelope = generate_feature_use_case_envelope(feature, generation_preference, db)
    return json_response_from_envelope(envelope, 200)


@router.get(
    "/feature-intents/{feature_id}/use-cases",
    response_model=list[UseCaseResource],
)
def list_use_cases(
    feature_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[UseCaseResource]:
    return list_owned_use_cases(db, current_user, feature_id)


@router.put(
    "/feature-intents/{feature_id}/use-cases",
    response_model=list[UseCaseResource],
)
def save_use_cases(
    feature_id: UUID,
    payload: UseCaseBulkSave,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[UseCaseResource]:
    return save_owned_use_cases(db, current_user, feature_id, payload)


@router.delete("/use-cases/{use_case_id}", status_code=204)
def delete_use_case(
    use_case_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    delete_owned_use_case(db, current_user, use_case_id)
    return Response(status_code=204)


@router.post("/use-cases/{use_case_id}/diagram/generate")
def generate_use_case_diagram(
    use_case_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> object:
    row = require_use_case(db, current_user, use_case_id)
    envelope = generate_use_case_diagram_envelope(row.content)
    status_code = 409 if envelope.error and envelope.error.code == "USE_CASE_NOT_APPROVED" else 200
    return json_response_from_envelope(envelope, status_code)


@router.get("/use-cases/{use_case_id}/diagram", response_model=DiagramResource | None)
def get_use_case_diagram(
    use_case_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> DiagramResource | None:
    return get_owned_use_case_diagram(db, current_user, use_case_id)


@router.put("/use-cases/{use_case_id}/diagram", response_model=DiagramResource)
def save_diagram(
    use_case_id: UUID,
    payload: DiagramSave,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> DiagramResource:
    return save_owned_diagram(db, current_user, use_case_id, payload)


@router.delete("/use-cases/{use_case_id}/diagram", status_code=204)
def delete_diagram(
    use_case_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    delete_owned_diagram(db, current_user, use_case_id)
    return Response(status_code=204)


@router.post("/diagrams/{diagram_id}/brd/validate")
def validate_saved_diagram(
    diagram_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> object:
    diagram = require_diagram(db, current_user, diagram_id)
    payload = stored_generate_request(diagram)
    return validate_brd_request(request, payload, "2026-05-31")


@router.post("/diagrams/{diagram_id}/brd/generate")
def generate_saved_diagram_brd(
    diagram_id: UUID,
    request: Request,
    template: str = "default",
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> object:
    diagram = require_diagram(db, current_user, diagram_id)
    payload = stored_generate_request(diagram, template)
    return generate_brd(request, payload, "2026-05-31", idempotency_key)


@router.get("/diagrams/{diagram_id}/brd", response_model=BrdResource | None)
def get_diagram_brd(
    diagram_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> BrdResource | None:
    return get_owned_brd(db, current_user, diagram_id)


@router.put("/diagrams/{diagram_id}/brd", response_model=BrdResource)
def save_brd(
    diagram_id: UUID,
    payload: BrdSave,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> BrdResource:
    return save_owned_brd(db, current_user, diagram_id, payload)


@router.delete("/diagrams/{diagram_id}/brd", status_code=204)
def delete_brd(
    diagram_id: UUID,
    current_user: CurrentUser = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> Response:
    delete_owned_brd(db, current_user, diagram_id)
    return Response(status_code=204)
