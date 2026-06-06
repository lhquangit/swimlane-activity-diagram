from __future__ import annotations

import re
from typing import Literal

from pydantic import Field, field_validator, model_validator

from .common import StrictBaseModel


ArtifactType = Literal[
    "project_spec",
    "feature_intent",
    "use_case_draft",
    "diagram_draft",
    "formal_brd_draft",
]


class ArtifactChainItem(StrictBaseModel):
    artifact_type: ArtifactType
    label: str
    source_of_truth: bool = False
    human_editable: bool = False
    generated_from: list[ArtifactType] = Field(default_factory=list)
    notes: str | None = None


class ProjectSpec(StrictBaseModel):
    project_name: str = Field(min_length=1)
    project_summary: str = Field(min_length=1)
    business_context: str | None = None
    target_users: list[str] = Field(default_factory=list)
    business_rules: list[str] = Field(default_factory=list)
    glossary: list[str] = Field(default_factory=list)

    @field_validator("project_name", "project_summary", mode="before")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator("business_context", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("target_users", "business_rules", "glossary", mode="before")
    @classmethod
    def normalize_lists(cls, value: list[str] | None) -> list[str]:
        return normalize_text_list(value)


class FeatureIntent(StrictBaseModel):
    feature_name: str = Field(min_length=1)
    function_name: str | None = None
    feature_summary: str = Field(min_length=1)
    primary_actor: str | None = None
    trigger: str | None = None
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    systems_involved: list[str] = Field(default_factory=list)
    success_outcome: str | None = None

    @field_validator("feature_name", "feature_summary", mode="before")
    @classmethod
    def normalize_feature_required_text(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator(
        "function_name",
        "primary_actor",
        "trigger",
        "success_outcome",
        mode="before",
    )
    @classmethod
    def normalize_feature_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator(
        "inputs",
        "outputs",
        "constraints",
        "assumptions",
        "systems_involved",
        mode="before",
    )
    @classmethod
    def normalize_feature_lists(cls, value: list[str] | None) -> list[str]:
        return normalize_text_list(value)


class UseCaseFlowStep(StrictBaseModel):
    step_id: str = Field(min_length=1)
    actor_ref: str = Field(min_length=1)
    action: str = Field(min_length=1)
    input_or_trigger: str | None = None
    expected_result: str = Field(min_length=1)

    @field_validator("step_id", "actor_ref", "action", "expected_result", mode="before")
    @classmethod
    def normalize_step_required_text(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator("input_or_trigger", mode="before")
    @classmethod
    def normalize_step_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class UseCaseAlternateFlow(StrictBaseModel):
    flow_id: str = Field(min_length=1)
    source_step_id: str = Field(min_length=1)
    condition: str = Field(min_length=1)
    steps: list[UseCaseFlowStep] = Field(min_length=1)
    rejoin_step_id: str | None = None
    terminal_outcome: str | None = None

    @field_validator("flow_id", "source_step_id", "condition", mode="before")
    @classmethod
    def normalize_flow_required_text(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator("rejoin_step_id", "terminal_outcome", mode="before")
    @classmethod
    def normalize_flow_optional_text(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @model_validator(mode="after")
    def validate_outcome_mode(self) -> "UseCaseAlternateFlow":
        if bool(self.rejoin_step_id) == bool(self.terminal_outcome):
            raise ValueError(
                "alternate flow phai co dung mot outcome: rejoin_step_id hoac terminal_outcome."
            )
        return self


class UseCaseDraft(StrictBaseModel):
    use_case_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    primary_actor: str = Field(min_length=1)
    supporting_actors: list[str] = Field(default_factory=list)
    preconditions: list[str] = Field(default_factory=list)
    happy_path_summary: list[str] = Field(default_factory=list)
    key_exceptions: list[str] = Field(default_factory=list)
    main_flow_steps: list[UseCaseFlowStep] = Field(min_length=1)
    alternate_flows: list[UseCaseAlternateFlow] = Field(default_factory=list)
    success_outcome: str = Field(min_length=1)
    review_status: Literal["draft", "reviewed", "approved"] = "draft"

    @field_validator(
        "use_case_id",
        "title",
        "objective",
        "primary_actor",
        "success_outcome",
        mode="before",
    )
    @classmethod
    def normalize_use_case_required_text(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator(
        "supporting_actors",
        "preconditions",
        "happy_path_summary",
        "key_exceptions",
        mode="before",
    )
    @classmethod
    def normalize_use_case_lists(cls, value: list[str] | None) -> list[str]:
        return normalize_text_list(value)

    @model_validator(mode="after")
    def validate_flow_references(self) -> "UseCaseDraft":
        actors = {self.primary_actor, *self.supporting_actors}
        main_step_ids = [step.step_id for step in self.main_flow_steps]
        step_ids = set(main_step_ids)
        if len(step_ids) != len(main_step_ids):
            raise ValueError("main_flow_steps.step_id phai unique.")
        for step in self.main_flow_steps:
            if step.actor_ref not in actors:
                raise ValueError(f"actor_ref khong ton tai: {step.actor_ref}")
        flow_id_values = [flow.flow_id for flow in self.alternate_flows]
        flow_ids = set(flow_id_values)
        if len(flow_ids) != len(flow_id_values):
            raise ValueError("alternate_flows.flow_id phai unique.")
        alternate_step_ids = [
            step.step_id for flow in self.alternate_flows for step in flow.steps
        ]
        all_step_ids = [*main_step_ids, *alternate_step_ids]
        if len(set(all_step_ids)) != len(all_step_ids):
            raise ValueError("Tat ca step_id trong use case phai unique.")
        projected_node_ids = [f"node-{graph_slug(step_id)}" for step_id in all_step_ids]
        if len(set(projected_node_ids)) != len(projected_node_ids):
            raise ValueError("step_id bi trung sau khi chuyen thanh graph node id.")
        projected_decision_ids = [
            f"decision-{graph_slug(flow_id)}" for flow_id in flow_id_values
        ]
        if len(set(projected_decision_ids)) != len(projected_decision_ids):
            raise ValueError("flow_id bi trung sau khi chuyen thanh graph decision id.")
        for flow in self.alternate_flows:
            if flow.source_step_id not in step_ids:
                raise ValueError(f"source_step_id khong ton tai: {flow.source_step_id}")
            if flow.rejoin_step_id and flow.rejoin_step_id not in step_ids:
                raise ValueError(f"rejoin_step_id khong ton tai: {flow.rejoin_step_id}")
            for step in flow.steps:
                if step.actor_ref not in actors:
                    raise ValueError(f"alternate actor_ref khong ton tai: {step.actor_ref}")
        return self


class DiagramTrace(StrictBaseModel):
    use_case_id: str
    source_kind: Literal[
        "use_case",
        "main_step",
        "alternate_flow",
        "precondition",
        "success_outcome",
        "terminal_outcome",
    ]
    source_id: str


class DiagramLaneDraft(StrictBaseModel):
    id: str
    title: str
    order: int
    width: int = 320


class DiagramNodeDraft(StrictBaseModel):
    id: str
    type: Literal["start", "end", "activity", "decision", "note"]
    lane_id: str | None = None
    text: str = ""
    x: float
    y: float
    properties: dict[str, object] = Field(default_factory=dict)
    trace: DiagramTrace


class DiagramEdgeDraft(StrictBaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    label: str | None = None
    trace: DiagramTrace


class DiagramDraft(StrictBaseModel):
    diagram_id: str
    use_case_id: str
    title: str
    lanes: list[DiagramLaneDraft]
    nodes: list[DiagramNodeDraft]
    edges: list[DiagramEdgeDraft]
    generation_status: Literal["ready"] = "ready"


class DiagramGenerationRequest(StrictBaseModel):
    use_case: UseCaseDraft
    language: Literal["vi"] = "vi"


class DiagramGenerationResult(StrictBaseModel):
    diagram: DiagramDraft


class UseCaseGenerationRequest(StrictBaseModel):
    project_spec: ProjectSpec
    feature_intent: FeatureIntent
    language: Literal["vi"] = "vi"
    generation_preference: Literal["auto", "ai", "deterministic"] = "auto"


class UseCaseGenerationResult(StrictBaseModel):
    generation_source: Literal["ai", "deterministic_fallback"]
    artifact_chain: list[ArtifactChainItem] = Field(default_factory=list)
    project_spec: ProjectSpec
    feature_intent: FeatureIntent
    use_cases: list[UseCaseDraft] = Field(default_factory=list)


def normalize_required_text(value: str) -> str:
    normalized = collapse_whitespace(value)
    if not normalized:
        raise ValueError("Gia tri bat buoc khong duoc de trong.")
    return normalized


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = collapse_whitespace(value)
    return normalized or None


def normalize_text_list(value: list[str] | None) -> list[str]:
    if not value:
        return []
    result: list[str] = []
    for item in value:
        normalized = collapse_whitespace(item)
        if not normalized or normalized in result:
            continue
        result.append(normalized)
    return result


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def graph_slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()
