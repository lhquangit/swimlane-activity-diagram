from __future__ import annotations

from pydantic import Field, field_validator, model_validator

from app.schemas.common import StrictBaseModel
from app.schemas.usecase import normalize_optional_text, normalize_required_text, normalize_text_list


class SynthesizedStep(StrictBaseModel):
    actor: str = Field(min_length=1)
    action: str = Field(min_length=1)
    input_or_trigger: str | None = None
    expected_result: str = Field(min_length=1)
    evidence_refs: list[str] = Field(min_length=1)

    @field_validator("actor", "action", "expected_result", mode="before")
    @classmethod
    def normalize_required_fields(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator("input_or_trigger", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("evidence_refs", mode="before")
    @classmethod
    def normalize_evidence(cls, value: list[str] | None) -> list[str]:
        return normalize_text_list(value)


class SynthesizedAlternateFlow(StrictBaseModel):
    source_step_number: int = Field(ge=1)
    condition: str = Field(min_length=1)
    steps: list[SynthesizedStep] = Field(min_length=1)
    rejoin_step_number: int | None = Field(default=None, ge=1)
    terminal_outcome: str | None = None
    evidence_refs: list[str] = Field(min_length=1)

    @field_validator("condition", mode="before")
    @classmethod
    def normalize_condition(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator("terminal_outcome", mode="before")
    @classmethod
    def normalize_terminal_outcome(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("evidence_refs", mode="before")
    @classmethod
    def normalize_evidence(cls, value: list[str] | None) -> list[str]:
        return normalize_text_list(value)

    @model_validator(mode="after")
    def validate_outcome(self) -> "SynthesizedAlternateFlow":
        if bool(self.rejoin_step_number) == bool(self.terminal_outcome):
            raise ValueError(
                "alternate flow must have exactly one rejoin_step_number or terminal_outcome."
            )
        return self


class SynthesizedUseCase(StrictBaseModel):
    title: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    primary_actor: str = Field(min_length=1)
    supporting_actors: list[str] = Field(default_factory=list)
    preconditions: list[str] = Field(default_factory=list)
    main_flow_steps: list[SynthesizedStep] = Field(min_length=1)
    alternate_flows: list[SynthesizedAlternateFlow] = Field(default_factory=list)
    success_outcome: str = Field(min_length=1)
    evidence_refs: list[str] = Field(min_length=1)

    @field_validator("title", "objective", "primary_actor", "success_outcome", mode="before")
    @classmethod
    def normalize_required_fields(cls, value: str) -> str:
        return normalize_required_text(value)

    @field_validator("supporting_actors", "preconditions", "evidence_refs", mode="before")
    @classmethod
    def normalize_lists(cls, value: list[str] | None) -> list[str]:
        return normalize_text_list(value)


class UseCaseSynthesisResult(StrictBaseModel):
    use_cases: list[SynthesizedUseCase] = Field(min_length=1, max_length=8)
