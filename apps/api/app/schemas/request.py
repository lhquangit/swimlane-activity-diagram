from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .common import StrictBaseModel


class LaneInput(StrictBaseModel):
    id: str
    title: str
    order: int


class NodeInput(StrictBaseModel):
    id: str
    type: Literal["start", "activity", "decision", "sync-bar", "end", "note"]
    lane_id: str | None = None
    text: str | None = None
    x: float
    y: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class EdgeInput(StrictBaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    label: str | None = None


class DiagramSemanticRequest(StrictBaseModel):
    diagram_id: str | None = None
    diagram_name: str
    language: Literal["vi"] = "vi"
    lanes: list[LaneInput]
    nodes: list[NodeInput]
    edges: list[EdgeInput]


class GenerateRequest(StrictBaseModel):
    diagram_id: str | None = None
    diagram_name: str
    project_name: str | None = None
    feature_name: str | None = None
    source_use_case_key: str | None = None
    source_use_case_title: str | None = None
    language: Literal["vi"] = "vi"
    lanes: list[LaneInput]
    nodes: list[NodeInput]
    edges: list[EdgeInput]
    template: Literal["default", "full"] = "default"
