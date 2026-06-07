from __future__ import annotations

from app.models import AppUser, BrdDoc, Diagram, FeatureIntentModel, Project, Spec, UseCaseModel
from app.schemas.persistence import (
    AppUserResource,
    BrdResource,
    DiagramResource,
    FeatureIntentResource,
    ProjectResource,
    SpecResource,
    UseCaseResource,
)
from app.schemas.usecase import UseCaseDraft


def app_user_resource(model: AppUser) -> AppUserResource:
    return AppUserResource.model_validate(model, from_attributes=True)


def project_resource(model: Project) -> ProjectResource:
    return ProjectResource.model_validate(model, from_attributes=True)


def spec_resource(model: Spec) -> SpecResource:
    return SpecResource.model_validate(model, from_attributes=True)


def feature_resource(model: FeatureIntentModel) -> FeatureIntentResource:
    return FeatureIntentResource(
        id=model.id,
        spec_id=model.spec_id,
        name=model.name,
        feature_summary=model.feature_summary,
        actors=model.actors,
        trigger=model.trigger,
        inputs=model.inputs,
        outputs=model.outputs,
        constraints=model.constraints,
        assumptions=model.assumptions,
        systems_involved=model.systems_involved,
        success_outcome=model.success_outcome,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def use_case_resource(model: UseCaseModel) -> UseCaseResource:
    return UseCaseResource(
        id=model.id,
        feature_intent_id=model.feature_intent_id,
        use_case_key=model.use_case_key,
        title=model.title,
        content=UseCaseDraft.model_validate(model.content),
        review_status=model.review_status,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def diagram_resource(model: Diagram) -> DiagramResource:
    source = model.source_use_case_updated_at
    current = model.use_case.updated_at if model.use_case else source
    return DiagramResource(
        id=model.id,
        use_case_id=model.use_case_id,
        title=model.title,
        graph_data=model.graph_data,
        lanes_data=model.lanes_data,
        lane_height=model.lane_height,
        semantic_edited=model.semantic_edited,
        source_use_case_updated_at=source,
        created_at=model.created_at,
        updated_at=model.updated_at,
        is_outdated=source < current,
    )


def brd_resource(model: BrdDoc) -> BrdResource:
    source = model.source_diagram_updated_at
    current = model.diagram.updated_at if model.diagram else source
    return BrdResource(
        id=model.id,
        diagram_id=model.diagram_id,
        title=model.title,
        structured_spec=model.structured_spec,
        markdown_content=model.markdown_content,
        warnings=model.warnings,
        template=model.template,
        source_diagram_updated_at=source,
        created_at=model.created_at,
        updated_at=model.updated_at,
        is_outdated=source < current,
    )
