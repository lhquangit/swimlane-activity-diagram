from __future__ import annotations

from dataclasses import dataclass

from app.schemas.usecase import FeatureIntent

from .actor_signals import is_technical_actor
from .synthesis_schema import UseCaseSynthesisResult


GENERIC_PHRASES = (
    "thực hiện các hành động nghiệp vụ chính",
    "xử lý theo quy trình",
    "hệ thống xử lý yêu cầu",
    "cập nhật kết quả phù hợp",
)


@dataclass(frozen=True)
class QualityIssue:
    code: str
    message: str


@dataclass(frozen=True)
class QualityResult:
    status: str
    issues: list[QualityIssue]
    score: float


def evaluate_synthesis(
    synthesis: UseCaseSynthesisResult,
    feature_intent: FeatureIntent | None = None,
) -> QualityResult:
    issues: list[QualityIssue] = []
    titles = [use_case.title.casefold() for use_case in synthesis.use_cases]
    if len(set(titles)) != len(titles):
        issues.append(QualityIssue("DUPLICATE_USE_CASE", "Use-case titles are duplicated."))

    total_steps = 0
    generic_steps = 0
    signatures: set[tuple[str, ...]] = set()
    for use_case in synthesis.use_cases:
        actions = tuple(step.action.casefold() for step in use_case.main_flow_steps)
        total_steps += len(actions)
        generic_steps += sum(
            any(phrase in action for phrase in GENERIC_PHRASES) for action in actions
        )
        if actions in signatures:
            issues.append(
                QualityIssue("DUPLICATE_FLOW", "Multiple use cases contain the same main flow.")
            )
        signatures.add(actions)
        if len(actions) < 2:
            issues.append(
                QualityIssue("FLOW_TOO_SHORT", f"Use case '{use_case.title}' has fewer than 2 steps.")
            )
        if not use_case.objective or use_case.objective.casefold() == use_case.title.casefold():
            issues.append(
                QualityIssue("WEAK_OBJECTIVE", f"Use case '{use_case.title}' has a weak objective.")
            )

    if feature_intent:
        expected_technical_actors = {
            actor.casefold()
            for actor in [*feature_intent.actors, *feature_intent.systems_involved]
            if actor and is_technical_actor(actor)
        }
        if expected_technical_actors:
            realized_step_actors = {
                step.actor.casefold()
                for use_case in synthesis.use_cases
                for step in use_case.main_flow_steps
            }
            realized_step_actors.update(
                step.actor.casefold()
                for use_case in synthesis.use_cases
                for flow in use_case.alternate_flows
                for step in flow.steps
            )
            if not expected_technical_actors.intersection(realized_step_actors):
                issues.append(
                    QualityIssue(
                        "MISSING_TECHNICAL_ACTOR_COVERAGE",
                        "Canonical input có actor kỹ thuật nhưng output không giao bước nào cho họ.",
                    )
                )

    if total_steps and generic_steps / total_steps >= 0.4:
        issues.append(
            QualityIssue("GENERIC_OUTPUT", "Too many steps use generic filler language.")
        )
    score = max(0.0, 1.0 - (len(issues) * 0.2))
    return QualityResult(status="rejected" if issues else "passed", issues=issues, score=score)
