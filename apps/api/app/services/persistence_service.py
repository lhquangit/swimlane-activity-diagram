from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser
from app.models import BrdDoc, Diagram, FeatureIntentModel, Project, Spec, UseCaseModel
from app.persistence import (
    not_found,
    require_diagram,
    require_feature,
    require_project,
    require_spec,
    require_use_case,
)
from app.schemas.persistence import (
    BrdResource,
    BrdSave,
    ArtifactTreeBrd,
    ArtifactTreeDiagram,
    ArtifactTreeFeature,
    ArtifactTreeUseCase,
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
    UseCaseSaveItem,
)
from app.services.persistence_serializers import (
    brd_resource,
    diagram_resource,
    feature_resource,
    project_resource,
    spec_resource,
    use_case_resource,
)


def list_owned_projects(db: Session, current_user: CurrentUser) -> list[ProjectResource]:
    projects = db.scalars(
        select(Project)
        .where(Project.app_user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    ).all()
    return [project_resource(project) for project in projects]


def create_owned_project(
    db: Session,
    current_user: CurrentUser,
    payload: ProjectCreate,
) -> ProjectResource:
    project = Project(
        app_user_id=current_user.id,
        name=payload.name,
        description=payload.description,
    )
    project.spec = Spec()
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_resource(project)


def get_owned_project(db: Session, current_user: CurrentUser, project_id: UUID) -> ProjectResource:
    return project_resource(require_project(db, current_user, project_id))


def get_owned_project_artifact_tree(
    db: Session,
    current_user: CurrentUser,
    project_id: UUID,
) -> ProjectArtifactTree:
    project = db.scalar(
        select(Project)
        .where(Project.id == project_id, Project.app_user_id == current_user.id)
        .options(
            selectinload(Project.spec)
            .selectinload(Spec.feature_intents)
            .selectinload(FeatureIntentModel.use_cases)
            .selectinload(UseCaseModel.diagram)
            .selectinload(Diagram.brd_doc)
        )
    )
    if project is None:
        raise not_found()

    features = sorted(
        project.spec.feature_intents,
        key=lambda item: (item.created_at, str(item.id)),
    )
    return ProjectArtifactTree(
        project=project_resource(project),
        spec=spec_resource(project.spec),
        features=[
            ArtifactTreeFeature(
                id=feature.id,
                name=feature.name,
                updated_at=feature.updated_at,
                use_cases=[
                    ArtifactTreeUseCase(
                        id=use_case.id,
                        use_case_key=use_case.use_case_key,
                        title=use_case.title,
                        review_status=use_case.review_status,
                        updated_at=use_case.updated_at,
                        diagram=(
                            ArtifactTreeDiagram(
                                id=use_case.diagram.id,
                                title=use_case.diagram.title,
                                semantic_edited=use_case.diagram.semantic_edited,
                                is_outdated=(
                                    use_case.diagram.source_use_case_updated_at
                                    < use_case.updated_at
                                ),
                                updated_at=use_case.diagram.updated_at,
                                brd=(
                                    ArtifactTreeBrd(
                                        id=use_case.diagram.brd_doc.id,
                                        title=use_case.diagram.brd_doc.title,
                                        template=use_case.diagram.brd_doc.template,
                                        is_outdated=(
                                            use_case.diagram.brd_doc.source_diagram_updated_at
                                            < use_case.diagram.updated_at
                                        ),
                                        updated_at=use_case.diagram.brd_doc.updated_at,
                                    )
                                    if use_case.diagram.brd_doc
                                    else None
                                ),
                            )
                            if use_case.diagram
                            else None
                        ),
                    )
                    for use_case in sorted(
                        feature.use_cases,
                        key=lambda item: (item.created_at, str(item.id)),
                    )
                ],
            )
            for feature in features
        ],
    )


def update_owned_project(
    db: Session,
    current_user: CurrentUser,
    project_id: UUID,
    payload: ProjectUpdate,
) -> ProjectResource:
    project = require_project(db, current_user, project_id)
    project.name = payload.name
    project.description = payload.description
    db.commit()
    db.refresh(project)
    return project_resource(project)


def delete_owned_project(db: Session, current_user: CurrentUser, project_id: UUID) -> None:
    db.delete(require_project(db, current_user, project_id))
    db.commit()


def get_owned_project_spec(
    db: Session,
    current_user: CurrentUser,
    project_id: UUID,
) -> SpecResource:
    project = require_project(db, current_user, project_id)
    return spec_resource(project.spec)


def update_owned_project_spec(
    db: Session,
    current_user: CurrentUser,
    project_id: UUID,
    payload: SpecUpdate,
) -> SpecResource:
    project = require_project(db, current_user, project_id)
    spec = project.spec
    for key, value in payload.model_dump().items():
        setattr(spec, key, value)
    db.commit()
    db.refresh(spec)
    return spec_resource(spec)


def list_owned_features(
    db: Session,
    current_user: CurrentUser,
    spec_id: UUID,
) -> list[FeatureIntentResource]:
    require_spec(db, current_user, spec_id)
    rows = db.scalars(
        select(FeatureIntentModel)
        .where(FeatureIntentModel.spec_id == spec_id)
        .order_by(FeatureIntentModel.updated_at.desc())
    ).all()
    return [feature_resource(row) for row in rows]


def create_owned_feature(
    db: Session,
    current_user: CurrentUser,
    spec_id: UUID,
    payload: FeatureIntentCreate,
) -> FeatureIntentResource:
    require_spec(db, current_user, spec_id)
    feature = FeatureIntentModel(spec_id=spec_id, **payload.model_dump())
    db.add(feature)
    db.commit()
    db.refresh(feature)
    return feature_resource(feature)


def get_owned_feature(
    db: Session,
    current_user: CurrentUser,
    feature_id: UUID,
) -> FeatureIntentResource:
    return feature_resource(require_feature(db, current_user, feature_id))


def update_owned_feature(
    db: Session,
    current_user: CurrentUser,
    feature_id: UUID,
    payload: FeatureIntentUpdate,
) -> FeatureIntentResource:
    feature = require_feature(db, current_user, feature_id)
    for key, value in payload.model_dump().items():
        setattr(feature, key, value)
    db.commit()
    db.refresh(feature)
    return feature_resource(feature)


def delete_owned_feature(db: Session, current_user: CurrentUser, feature_id: UUID) -> None:
    db.delete(require_feature(db, current_user, feature_id))
    db.commit()


def list_owned_use_cases(
    db: Session,
    current_user: CurrentUser,
    feature_id: UUID,
) -> list[UseCaseResource]:
    require_feature(db, current_user, feature_id)
    rows = db.scalars(
        select(UseCaseModel)
        .where(UseCaseModel.feature_intent_id == feature_id)
        .order_by(UseCaseModel.created_at.asc())
    ).all()
    return [use_case_resource(row) for row in rows]


def save_owned_use_cases(
    db: Session,
    current_user: CurrentUser,
    feature_id: UUID,
    payload: UseCaseBulkSave,
) -> list[UseCaseResource]:
    require_feature(db, current_user, feature_id)
    existing_rows = db.scalars(
        select(UseCaseModel).where(UseCaseModel.feature_intent_id == feature_id)
    ).all()
    existing_by_key = {row.use_case_key: row for row in existing_rows}
    retained_existing_ids: set[UUID] = set()
    resolved_rows: list[tuple[UseCaseSaveItem, UseCaseModel | None]] = []

    for item in payload.items:
        row: UseCaseModel | None = None
        if item.id is not None:
            owned = require_use_case(db, current_user, item.id)
            if owned.feature_intent_id != feature_id:
                raise not_found()
            row = owned
        else:
            row = existing_by_key.get(item.content.use_case_id)
        if row is not None:
            retained_existing_ids.add(row.id)
        resolved_rows.append((item, row))

    omitted_rows = [
        row for row in existing_rows if row.id not in retained_existing_ids
    ]
    for row in omitted_rows:
        db.delete(row)
    if omitted_rows:
        db.flush()

    result: list[UseCaseModel] = []
    for item, row in resolved_rows:
        draft = item.content
        if row is None:
            row = UseCaseModel(feature_intent_id=feature_id, use_case_key=draft.use_case_id)
            db.add(row)
        row.use_case_key = draft.use_case_id
        row.title = draft.title
        row.content = draft.model_dump(mode="json")
        row.review_status = draft.review_status
        result.append(row)
    db.commit()
    for row in result:
        db.refresh(row)
    return [use_case_resource(row) for row in result]


def delete_owned_use_case(db: Session, current_user: CurrentUser, use_case_id: UUID) -> None:
    db.delete(require_use_case(db, current_user, use_case_id))
    db.commit()


def get_owned_use_case_diagram(
    db: Session,
    current_user: CurrentUser,
    use_case_id: UUID,
) -> DiagramResource | None:
    row = require_use_case(db, current_user, use_case_id)
    if row.diagram is None:
        return None
    return diagram_resource(row.diagram)


def save_owned_diagram(
    db: Session,
    current_user: CurrentUser,
    use_case_id: UUID,
    payload: DiagramSave,
) -> DiagramResource:
    use_case = require_use_case(db, current_user, use_case_id)
    row = use_case.diagram or Diagram(use_case_id=use_case.id)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.source_use_case_updated_at = use_case.updated_at
    db.add(row)
    db.commit()
    db.refresh(row)
    row.use_case = use_case
    return diagram_resource(row)


def delete_owned_diagram(db: Session, current_user: CurrentUser, use_case_id: UUID) -> None:
    use_case = require_use_case(db, current_user, use_case_id)
    if use_case.diagram is not None:
        db.delete(use_case.diagram)
        db.commit()


def get_owned_brd(
    db: Session,
    current_user: CurrentUser,
    diagram_id: UUID,
) -> BrdResource | None:
    diagram = require_diagram(db, current_user, diagram_id)
    return brd_resource(diagram.brd_doc) if diagram.brd_doc else None


def save_owned_brd(
    db: Session,
    current_user: CurrentUser,
    diagram_id: UUID,
    payload: BrdSave,
) -> BrdResource:
    diagram = require_diagram(db, current_user, diagram_id)
    row = diagram.brd_doc or BrdDoc(diagram_id=diagram.id)
    values = payload.model_dump(mode="json")
    values["warnings"] = [warning.model_dump(mode="json") for warning in payload.warnings]
    for key, value in values.items():
        setattr(row, key, value)
    row.source_diagram_updated_at = diagram.updated_at
    db.add(row)
    db.commit()
    db.refresh(row)
    row.diagram = diagram
    return brd_resource(row)


def delete_owned_brd(db: Session, current_user: CurrentUser, diagram_id: UUID) -> None:
    diagram = require_diagram(db, current_user, diagram_id)
    if diagram.brd_doc is not None:
        db.delete(diagram.brd_doc)
        db.commit()
