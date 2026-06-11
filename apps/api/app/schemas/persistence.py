from __future__ import annotations

from datetime import datetime
import math
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.common import ResponseMetadata, StrictBaseModel, WarningItem
from app.schemas.usecase import UseCaseDraft


SUPPORTED_DIAGRAM_NODE_TYPES = {
    "start",
    "end",
    "activity",
    "decision",
    "note",
    "sync-bar",
    "lane",
}
LANE_BOUND_NODE_TYPES = {"activity", "decision", "note"}


def normalize_text(value: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError("Value must not be blank.")
    return normalized


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split())
    return normalized or None


def normalize_string_list(value: list[str] | None) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in value or []:
        normalized = " ".join(item.split())
        key = normalized.casefold()
        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)
    return result


class AppUserResource(StrictBaseModel):
    id: UUID
    clerk_user_id: str
    email: str | None = None
    display_name: str | None = None
    role: Literal["user", "admin"]
    created_at: datetime
    updated_at: datetime


class ProjectCreate(StrictBaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None

    _name = field_validator("name", mode="before")(normalize_text)
    _description = field_validator("description", mode="before")(normalize_optional_text)


class ProjectUpdate(ProjectCreate):
    pass


class ProjectResource(ProjectCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime


class SpecUpdate(StrictBaseModel):
    project_summary: str = ""
    business_context: str | None = None
    target_users: list[str] = Field(default_factory=list)
    business_rules: list[str] = Field(default_factory=list)
    glossary: list[str] = Field(default_factory=list)

    @field_validator("project_summary", mode="before")
    @classmethod
    def normalize_summary(cls, value: str | None) -> str:
        return " ".join((value or "").split())

    _context = field_validator("business_context", mode="before")(normalize_optional_text)
    _lists = field_validator(
        "target_users", "business_rules", "glossary", mode="before"
    )(normalize_string_list)


class SpecResource(SpecUpdate):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class FeatureIntentCreate(StrictBaseModel):
    name: str = Field(min_length=1, max_length=255)
    feature_summary: str = Field(min_length=1)
    actors: list[str] = Field(default_factory=list)
    trigger: str | None = None
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    systems_involved: list[str] = Field(default_factory=list)
    success_outcome: str | None = None

    _name = field_validator("name", "feature_summary", mode="before")(normalize_text)
    _optional = field_validator(
        "trigger", "success_outcome", mode="before"
    )(normalize_optional_text)
    _lists = field_validator(
        "actors",
        "inputs",
        "outputs",
        "constraints",
        "assumptions",
        "systems_involved",
        mode="before",
    )(normalize_string_list)


class FeatureIntentUpdate(FeatureIntentCreate):
    pass


class FeatureIntentResource(FeatureIntentCreate):
    id: UUID
    spec_id: UUID
    latest_usecase_generation: ResponseMetadata | None = None
    created_at: datetime
    updated_at: datetime


class UseCaseSaveItem(StrictBaseModel):
    id: UUID | None = None
    content: UseCaseDraft


class UseCaseBulkSave(StrictBaseModel):
    items: list[UseCaseSaveItem]
    committed_generation_metadata: ResponseMetadata | None = None

    @model_validator(mode="after")
    def unique_keys(self) -> "UseCaseBulkSave":
        keys = [item.content.use_case_id for item in self.items]
        if len(keys) != len(set(keys)):
            raise ValueError("use_case_id must be unique within the portfolio.")
        return self


class UseCaseResource(StrictBaseModel):
    id: UUID
    feature_intent_id: UUID
    use_case_key: str
    title: str
    content: UseCaseDraft
    review_status: Literal["draft", "reviewed", "approved"]
    created_at: datetime
    updated_at: datetime


class ArtifactTreeBrd(StrictBaseModel):
    id: UUID
    title: str
    template: Literal["default", "full"]
    is_outdated: bool
    updated_at: datetime


class ArtifactTreeDiagram(StrictBaseModel):
    id: UUID
    title: str
    semantic_edited: bool
    is_outdated: bool
    updated_at: datetime
    brd: ArtifactTreeBrd | None = None


class ArtifactTreeUseCase(StrictBaseModel):
    id: UUID
    use_case_key: str
    title: str
    review_status: Literal["draft", "reviewed", "approved"]
    updated_at: datetime
    diagram: ArtifactTreeDiagram | None = None


class ArtifactTreeFeature(StrictBaseModel):
    id: UUID
    name: str
    updated_at: datetime
    use_cases: list[ArtifactTreeUseCase] = Field(default_factory=list)


class ProjectArtifactTree(StrictBaseModel):
    project: ProjectResource
    spec: SpecResource
    features: list[ArtifactTreeFeature] = Field(default_factory=list)


class DiagramSave(StrictBaseModel):
    title: str = Field(min_length=1, max_length=255)
    graph_data: dict[str, Any]
    lanes_data: list[dict[str, Any]]
    lane_height: int = Field(gt=0, le=100000)
    semantic_edited: bool = False

    _title = field_validator("title", mode="before")(normalize_text)

    @model_validator(mode="after")
    def validate_graph_size(self) -> "DiagramSave":
        nodes = self.graph_data.get("nodes", [])
        edges = self.graph_data.get("edges", [])
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("graph_data must contain nodes and edges arrays.")
        if len(nodes) > 2000 or len(edges) > 5000 or len(self.lanes_data) > 100:
            raise ValueError("Diagram exceeds MVP payload limits.")
        validate_saved_diagram_graph(self.graph_data, self.lanes_data)
        return self


def _record(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object.")
    return value


def _text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string.")
    return value.strip()


def _finite_number(value: Any, label: str) -> float:
    if not isinstance(value, int | float) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"{label} must be a finite number.")
    return float(value)


def _node_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        nested = value.get("value", "")
        return nested if isinstance(nested, str) else str(nested or "")
    return str(value)


def _node_lane_id(node: dict[str, Any]) -> str | None:
    properties = node.get("properties") or {}
    if not isinstance(properties, dict):
        raise ValueError(f"node {node.get('id', '<unknown>')} properties must be an object.")
    lane_id = properties.get("laneId") or properties.get("lane_id")
    return lane_id.strip() if isinstance(lane_id, str) and lane_id.strip() else None


def validate_saved_diagram_graph(
    graph_data: dict[str, Any],
    lanes_data: list[dict[str, Any]],
) -> None:
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError("graph_data must contain nodes and edges arrays.")

    lane_ids: set[str] = set()
    for index, lane in enumerate(lanes_data):
        lane_record = _record(lane, f"lanes_data[{index}]")
        lane_ids.add(_text(lane_record.get("id"), f"lanes_data[{index}].id"))

    node_ids: set[str] = set()
    for index, raw_node in enumerate(nodes):
        node = _record(raw_node, f"graph_data.nodes[{index}]")
        node_id = _text(node.get("id"), f"graph_data.nodes[{index}].id")
        if node_id in node_ids:
            raise ValueError(f"Duplicate diagram node id: {node_id}.")
        node_ids.add(node_id)

        node_type = _text(node.get("type"), f"graph_data.nodes[{index}].type")
        if node_type not in SUPPORTED_DIAGRAM_NODE_TYPES:
            raise ValueError(f"Unsupported diagram node type: {node_type}.")

        _finite_number(node.get("x"), f"graph_data.nodes[{index}].x")
        _finite_number(node.get("y"), f"graph_data.nodes[{index}].y")
        _node_text(node.get("text"))

        if lane_ids and node_type in LANE_BOUND_NODE_TYPES:
            lane_id = _node_lane_id(node)
            if not lane_id or lane_id not in lane_ids:
                raise ValueError(f"node {node_id} must reference an existing lane.")

    edge_ids: set[str] = set()
    for index, raw_edge in enumerate(edges):
        edge = _record(raw_edge, f"graph_data.edges[{index}]")
        edge_id = _text(edge.get("id"), f"graph_data.edges[{index}].id")
        if edge_id in edge_ids:
            raise ValueError(f"Duplicate diagram edge id: {edge_id}.")
        edge_ids.add(edge_id)

        source_id = edge.get("sourceNodeId") or edge.get("source_node_id")
        target_id = edge.get("targetNodeId") or edge.get("target_node_id")
        source = _text(source_id, f"graph_data.edges[{index}].sourceNodeId")
        target = _text(target_id, f"graph_data.edges[{index}].targetNodeId")
        if source not in node_ids:
            raise ValueError(f"edge {edge_id} source node does not exist: {source}.")
        if target not in node_ids:
            raise ValueError(f"edge {edge_id} target node does not exist: {target}.")


class DiagramResource(DiagramSave):
    id: UUID
    use_case_id: UUID
    source_use_case_updated_at: datetime
    created_at: datetime
    updated_at: datetime
    is_outdated: bool = False


class BrdSave(StrictBaseModel):
    title: str = Field(min_length=1, max_length=255)
    structured_spec: dict[str, Any]
    markdown_content: str = Field(max_length=2_000_000)
    warnings: list[WarningItem] = Field(default_factory=list)
    template: Literal["default", "full"] = "default"

    _title = field_validator("title", mode="before")(normalize_text)


class BrdDocxExportRequest(StrictBaseModel):
    title: str = Field(min_length=1, max_length=255)
    markdown_content: str = Field(min_length=1, max_length=2_000_000)

    _title = field_validator("title", mode="before")(normalize_text)


class BrdResource(BrdSave):
    id: UUID
    diagram_id: UUID
    source_diagram_updated_at: datetime
    created_at: datetime
    updated_at: datetime
    is_outdated: bool = False
