from __future__ import annotations

from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Diagram, FeatureIntentModel
from app.schemas.common import ErrorObject, ResponseEnvelope, ResponseMetadata
from app.schemas.persistence import validate_saved_diagram_graph
from app.schemas.request import GenerateRequest
from app.schemas.usecase import FeatureIntent, ProjectSpec, UseCaseDraft, UseCaseGenerationResult
from app.services.diagram_builder import generate_diagram_draft
from app.usecases.deterministic_builder import build_artifact_chain
from app.usecases.generation_service import UseCaseGenerationService


generation_service = UseCaseGenerationService(settings)


def generate_feature_use_case_envelope(
    feature: FeatureIntentModel,
    generation_preference: str,
    db: Session,
) -> ResponseEnvelope:
    spec = feature.spec
    project = spec.project
    project_spec = ProjectSpec(
        project_name=project.name,
        project_summary=spec.project_summary or project.description or project.name,
        business_context=spec.business_context,
        target_users=spec.target_users,
        business_rules=spec.business_rules,
        glossary=spec.glossary,
    )
    intent = FeatureIntent(
        feature_name=feature.name,
        feature_summary=feature.feature_summary,
        actors=feature.actors,
        primary_actor=feature.actors[0] if feature.actors else None,
        trigger=feature.trigger,
        inputs=feature.inputs,
        outputs=feature.outputs,
        constraints=feature.constraints,
        assumptions=feature.assumptions,
        systems_involved=feature.systems_involved,
        success_outcome=feature.success_outcome,
    )
    preference = (
        generation_preference
        if generation_preference in {"auto", "ai", "deterministic"}
        else "auto"
    )
    outcome = generation_service.generate(project_spec, intent, preference)
    feature.latest_usecase_generation = outcome.metadata.model_dump(
        mode="json",
        exclude_none=True,
    )
    db.add(feature)
    db.commit()
    db.refresh(feature)
    result = UseCaseGenerationResult(
        generation_source=outcome.metadata.generation_source or "deterministic_fallback",
        artifact_chain=build_artifact_chain(),
        project_spec=project_spec,
        feature_intent=intent,
        use_cases=outcome.use_cases,
    )
    return ResponseEnvelope(
        request_id=f"req_{uuid4().hex[:12]}",
        status="completed",
        warnings=outcome.warnings,
        result=result.model_dump(mode="json"),
        metadata=outcome.metadata,
    )


def generate_use_case_diagram_envelope(row_content: dict[str, object]) -> ResponseEnvelope:
    draft = UseCaseDraft.model_validate(row_content)
    if draft.review_status != "approved":
        return ResponseEnvelope(
            request_id=f"req_{uuid4().hex[:12]}",
            status="failed",
            error=ErrorObject(
                code="USE_CASE_NOT_APPROVED",
                message="Use case must be approved and saved first.",
                retryable=False,
            ),
        )
    generated = generate_diagram_draft(draft)
    return ResponseEnvelope(
        request_id=f"req_{uuid4().hex[:12]}",
        status="completed",
        result={"diagram": generated.model_dump(mode="json")},
        metadata=ResponseMetadata(
            provider="deterministic",
            model="usecase-diagram-builder-v1",
        ),
    )


def stored_generate_request(diagram: Diagram, template: str = "default") -> GenerateRequest:
    try:
        validate_saved_diagram_graph(diagram.graph_data, diagram.lanes_data)
    except (TypeError, ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    lanes = [
        {
            "id": str(lane["id"]),
            "title": str(lane.get("title") or lane["id"]),
            "order": int(lane.get("order", index)),
        }
        for index, lane in enumerate(diagram.lanes_data)
    ]
    nodes = []
    for node in diagram.graph_data.get("nodes", []):
        if node["type"] == "lane":
            continue
        properties = node.get("properties") or {}
        text_value = node.get("text", "")
        if isinstance(text_value, dict):
            text_value = text_value.get("value", "")
        nodes.append(
            {
                "id": str(node["id"]),
                "type": node["type"],
                "lane_id": properties.get("laneId") or properties.get("lane_id"),
                "text": str(text_value or ""),
                "x": float(node["x"]),
                "y": float(node["y"]),
                "metadata": properties,
            }
        )
    edges = [
        {
            "id": str(edge["id"]),
            "source_node_id": edge.get("sourceNodeId") or edge.get("source_node_id"),
            "target_node_id": edge.get("targetNodeId") or edge.get("target_node_id"),
            "label": (
                edge.get("text", {}).get("value")
                if isinstance(edge.get("text"), dict)
                else edge.get("text") or edge.get("label")
            ),
        }
        for edge in diagram.graph_data.get("edges", [])
    ]
    return GenerateRequest(
        diagram_id=str(diagram.id),
        diagram_name=diagram.title,
        language="vi",
        lanes=lanes,
        nodes=nodes,
        edges=edges,
        template=template,
    )
