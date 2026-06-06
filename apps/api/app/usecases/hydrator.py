from __future__ import annotations

from app.schemas.usecase import (
    FeatureIntent,
    ProjectSpec,
    UseCaseAlternateFlow,
    UseCaseDraft,
    UseCaseFlowStep,
)

from .deterministic_builder import build_use_case_prefix
from .synthesis_schema import SynthesizedStep, UseCaseSynthesisResult


class HydrationError(ValueError):
    pass


def hydrate_synthesis(
    synthesis: UseCaseSynthesisResult,
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
) -> list[UseCaseDraft]:
    prefix = build_use_case_prefix(project_spec.project_name, feature_intent.feature_name)
    drafts: list[UseCaseDraft] = []
    seen_titles: set[str] = set()

    for use_case_number, synthesized in enumerate(synthesis.use_cases, start=1):
        normalized_title = synthesized.title.casefold()
        if normalized_title in seen_titles:
            raise HydrationError(f"Duplicate synthesized use-case title: {synthesized.title}")
        seen_titles.add(normalized_title)
        use_case_id = f"{prefix}-{use_case_number:02d}"
        main_steps = [
            _hydrate_step(step, f"{use_case_id}-S{step_number:02d}")
            for step_number, step in enumerate(synthesized.main_flow_steps, start=1)
        ]
        alternate_flows: list[UseCaseAlternateFlow] = []
        for flow_number, flow in enumerate(synthesized.alternate_flows, start=1):
            if flow.source_step_number > len(main_steps):
                raise HydrationError("Alternate flow source step is outside the main flow.")
            if flow.rejoin_step_number and flow.rejoin_step_number > len(main_steps):
                raise HydrationError("Alternate flow rejoin step is outside the main flow.")
            flow_id = f"{use_case_id}-A{flow_number:02d}"
            alternate_flows.append(
                UseCaseAlternateFlow(
                    flow_id=flow_id,
                    source_step_id=main_steps[flow.source_step_number - 1].step_id,
                    condition=flow.condition,
                    steps=[
                        _hydrate_step(step, f"{flow_id}-S{step_number:02d}")
                        for step_number, step in enumerate(flow.steps, start=1)
                    ],
                    rejoin_step_id=(
                        main_steps[flow.rejoin_step_number - 1].step_id
                        if flow.rejoin_step_number
                        else None
                    ),
                    terminal_outcome=flow.terminal_outcome,
                )
            )

        drafts.append(
            UseCaseDraft(
                use_case_id=use_case_id,
                title=synthesized.title,
                objective=synthesized.objective,
                primary_actor=synthesized.primary_actor,
                supporting_actors=synthesized.supporting_actors,
                preconditions=synthesized.preconditions,
                happy_path_summary=[step.action for step in main_steps],
                key_exceptions=[flow.condition for flow in alternate_flows],
                main_flow_steps=main_steps,
                alternate_flows=alternate_flows,
                success_outcome=synthesized.success_outcome,
                review_status="draft",
            )
        )
    return drafts


def _hydrate_step(step: SynthesizedStep, step_id: str) -> UseCaseFlowStep:
    return UseCaseFlowStep(
        step_id=step_id,
        actor_ref=step.actor,
        action=step.action,
        input_or_trigger=step.input_or_trigger,
        expected_result=step.expected_result,
    )
