from __future__ import annotations

from dataclasses import dataclass

from app.schemas.usecase import FeatureIntent, ProjectSpec

from .actor_signals import is_technical_actor
from .synthesis_schema import UseCaseSynthesisResult


@dataclass(frozen=True)
class GroundingIssue:
    code: str
    message: str


def build_grounding_catalog(
    project_spec: ProjectSpec, feature_intent: FeatureIntent
) -> dict[str, str]:
    catalog = {
        "project.project_name": project_spec.project_name,
        "project.project_summary": project_spec.project_summary,
        "feature.feature_name": feature_intent.feature_name,
        "feature.feature_summary": feature_intent.feature_summary,
    }
    optional_values = {
        "project.business_context": project_spec.business_context,
        "feature.primary_actor": feature_intent.primary_actor,
        "feature.trigger": feature_intent.trigger,
        "feature.success_outcome": feature_intent.success_outcome,
    }
    catalog.update({key: value for key, value in optional_values.items() if value})
    for field_name, values in (
        ("project.target_users", project_spec.target_users),
        ("project.business_rules", project_spec.business_rules),
        ("feature.inputs", feature_intent.inputs),
        ("feature.outputs", feature_intent.outputs),
        ("feature.constraints", feature_intent.constraints),
        ("feature.assumptions", feature_intent.assumptions),
        ("feature.actors", feature_intent.actors),
        ("feature.systems_involved", feature_intent.systems_involved),
    ):
        catalog.update({f"{field_name}.{index}": value for index, value in enumerate(values)})
    return catalog


def validate_grounding(
    synthesis: UseCaseSynthesisResult,
    project_spec: ProjectSpec,
    feature_intent: FeatureIntent,
) -> list[GroundingIssue]:
    catalog = build_grounding_catalog(project_spec, feature_intent)
    allowed_refs = set(catalog)
    allowed_actors = {
        actor.casefold()
        for actor in [
            *project_spec.target_users,
            *feature_intent.actors,
            *feature_intent.systems_involved,
            feature_intent.primary_actor or "",
            "Hệ thống",
        ]
        if actor
    }
    issues: list[GroundingIssue] = []

    for use_case in synthesis.use_cases:
        actors = [use_case.primary_actor, *use_case.supporting_actors]
        for actor in actors:
            if actor.casefold() not in allowed_actors:
                issues.append(
                    GroundingIssue("UNSUPPORTED_ACTOR", f"Actor không có trong input: {actor}")
                )
        if any(is_technical_actor(actor) for actor in feature_intent.actors):
            used_step_actors = {
                step.actor.casefold()
                for step in use_case.main_flow_steps
            }
            used_step_actors.update(
                step.actor.casefold()
                for flow in use_case.alternate_flows
                for step in flow.steps
            )
            technical_actor_keys = {
                actor.casefold()
                for actor in [*feature_intent.actors, *feature_intent.systems_involved]
                if actor and is_technical_actor(actor)
            }
            if technical_actor_keys and not technical_actor_keys.intersection(used_step_actors):
                issues.append(
                    GroundingIssue(
                        "MISSING_TECHNICAL_ACTOR_COVERAGE",
                        "Output không gán bước nào cho actor kỹ thuật có trong canonical input.",
                    )
                )
        evidence_groups = [use_case.evidence_refs]
        evidence_groups.extend(step.evidence_refs for step in use_case.main_flow_steps)
        for flow in use_case.alternate_flows:
            evidence_groups.append(flow.evidence_refs)
            evidence_groups.extend(step.evidence_refs for step in flow.steps)
        for evidence_refs in evidence_groups:
            for evidence_ref in evidence_refs:
                if evidence_ref not in allowed_refs:
                    issues.append(
                        GroundingIssue(
                            "UNKNOWN_EVIDENCE_REF",
                            f"Evidence ref không thuộc canonical input: {evidence_ref}",
                        )
                    )
    return issues
