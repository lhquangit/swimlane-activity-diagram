from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import CurrentUser
from app.models import BrdDoc, Diagram, FeatureIntentModel, Project, Spec, UseCaseModel


def not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Resource not found.")


def require_project(db: Session, current_user: CurrentUser, project_id: UUID) -> Project:
    project = db.scalar(
        select(Project)
        .options(joinedload(Project.spec))
        .where(Project.id == project_id, Project.app_user_id == current_user.id)
    )
    if project is None:
        raise not_found()
    return project


def require_spec(db: Session, current_user: CurrentUser, spec_id: UUID) -> Spec:
    spec = db.scalar(
        select(Spec)
        .join(Project, Spec.project_id == Project.id)
        .options(joinedload(Spec.project))
        .where(Spec.id == spec_id, Project.app_user_id == current_user.id)
    )
    if spec is None:
        raise not_found()
    return spec


def require_feature(db: Session, current_user: CurrentUser, feature_id: UUID) -> FeatureIntentModel:
    feature = db.scalar(
        select(FeatureIntentModel)
        .join(Spec, FeatureIntentModel.spec_id == Spec.id)
        .join(Project, Spec.project_id == Project.id)
        .options(joinedload(FeatureIntentModel.spec).joinedload(Spec.project))
        .where(FeatureIntentModel.id == feature_id, Project.app_user_id == current_user.id)
    )
    if feature is None:
        raise not_found()
    return feature


def require_use_case(db: Session, current_user: CurrentUser, use_case_id: UUID) -> UseCaseModel:
    use_case = db.scalar(
        select(UseCaseModel)
        .join(FeatureIntentModel, UseCaseModel.feature_intent_id == FeatureIntentModel.id)
        .join(Spec, FeatureIntentModel.spec_id == Spec.id)
        .join(Project, Spec.project_id == Project.id)
        .options(
            joinedload(UseCaseModel.feature_intent)
            .joinedload(FeatureIntentModel.spec)
            .joinedload(Spec.project)
        )
        .where(UseCaseModel.id == use_case_id, Project.app_user_id == current_user.id)
    )
    if use_case is None:
        raise not_found()
    return use_case


def require_diagram(db: Session, current_user: CurrentUser, diagram_id: UUID) -> Diagram:
    diagram = db.scalar(
        select(Diagram)
        .join(UseCaseModel, Diagram.use_case_id == UseCaseModel.id)
        .join(FeatureIntentModel, UseCaseModel.feature_intent_id == FeatureIntentModel.id)
        .join(Spec, FeatureIntentModel.spec_id == Spec.id)
        .join(Project, Spec.project_id == Project.id)
        .options(joinedload(Diagram.use_case))
        .where(Diagram.id == diagram_id, Project.app_user_id == current_user.id)
    )
    if diagram is None:
        raise not_found()
    return diagram


def require_brd(db: Session, current_user: CurrentUser, brd_id: UUID) -> BrdDoc:
    brd = db.scalar(
        select(BrdDoc)
        .join(Diagram, BrdDoc.diagram_id == Diagram.id)
        .join(UseCaseModel, Diagram.use_case_id == UseCaseModel.id)
        .join(FeatureIntentModel, UseCaseModel.feature_intent_id == FeatureIntentModel.id)
        .join(Spec, FeatureIntentModel.spec_id == Spec.id)
        .join(Project, Spec.project_id == Project.id)
        .options(joinedload(BrdDoc.diagram))
        .where(BrdDoc.id == brd_id, Project.app_user_id == current_user.id)
    )
    if brd is None:
        raise not_found()
    return brd
