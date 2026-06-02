from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import StrictBaseModel, WarningItem


class SpecMetadata(StrictBaseModel):
    diagram_name: str
    source_language: Literal["vi"] = "vi"
    generated_language: Literal["vi"] = "vi"
    generated_at: datetime
    generator_model: str
    generator_version: str


class ActorItem(StrictBaseModel):
    lane_id: str
    actor_name: str
    responsibilities: list[str] = Field(default_factory=list)


class MainFlowStep(StrictBaseModel):
    step_id: str
    node_id: str
    actor_lane_id: str | None = None
    actor_name: str | None = None
    step_title: str | None = None
    step_purpose: str | None = None
    business_action: str | None = None
    expected_result: str | None = None
    input_or_trigger: str | None = None
    description: str


class BranchOutcome(StrictBaseModel):
    label: str | None = None
    target_node_id: str
    target_node_text: str | None = None
    status: Literal["labeled", "unlabeled"]
    path_summary: list[str] = Field(default_factory=list)
    rejoin_node_id: str | None = None
    rejoin_node_text: str | None = None
    continues_main_flow: bool = False


class BranchItem(StrictBaseModel):
    decision_node_id: str
    decision_text: str
    decision_actor_name: str | None = None
    outcomes: list[BranchOutcome] = Field(default_factory=list)


class ParallelBlock(StrictBaseModel):
    fork_node_id: str
    join_node_id: str | None = None
    lane_ids: list[str] = Field(default_factory=list)
    role: Literal["fork", "join", "fork_join", "sync"] | None = None
    actor_names: list[str] = Field(default_factory=list)
    branch_summaries: list[str] = Field(default_factory=list)
    join_summary: str | None = None
    description: str


class HandoffItem(StrictBaseModel):
    from_actor: str
    to_actor: str
    source_node_id: str
    target_node_id: str
    source_step_text: str | None = None
    target_step_text: str | None = None
    reason: str | None = None


class LoopItem(StrictBaseModel):
    node_ids: list[str] = Field(default_factory=list)
    note: str


class DiagramBRDSpec(StrictBaseModel):
    metadata: SpecMetadata
    summary: str
    actors: list[ActorItem] = Field(default_factory=list)
    main_flow_steps: list[MainFlowStep] = Field(default_factory=list)
    branches: list[BranchItem] = Field(default_factory=list)
    parallel_blocks: list[ParallelBlock] = Field(default_factory=list)
    handoffs: list[HandoffItem] = Field(default_factory=list)
    loops: list[LoopItem] = Field(default_factory=list)
    annotations: list[str] = Field(default_factory=list)
    context_notes: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    warnings: list[WarningItem] = Field(default_factory=list)
