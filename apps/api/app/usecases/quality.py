from __future__ import annotations

from dataclasses import dataclass

from app.schemas.usecase import FeatureIntent

from .actor_signals import is_technical_actor
from .synthesis_schema import SynthesizedUseCase, UseCaseSynthesisResult


GENERIC_PHRASES = (
    "thực hiện các hành động nghiệp vụ chính",
    "xử lý theo quy trình",
    "hệ thống xử lý yêu cầu",
    "cập nhật kết quả phù hợp",
    "mở thông tin chi tiết cần xử lý",
    "theo intent đã mô tả",
    "ghi nhận và xử lý ngoại lệ theo quy trình",
)

GENERIC_USE_CASE_BOUNDARY_PHRASES = (
    "thực hiện xử lý chính",
    "phối hợp actor và hệ thống",
    "xử lý ngoại lệ, từ chối, hoặc điều chỉnh",
    "thực thi nghiệp vụ cốt lõi",
    "nghiệp vụ được hoàn tất",
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


def _contains_generic_phrase(text: str, phrases: tuple[str, ...]) -> bool:
    lowered = text.casefold()
    return any(phrase in lowered for phrase in phrases)


def _has_evidence_with_prefix(evidence_refs: set[str], prefix: str) -> bool:
    return any(ref.startswith(prefix) for ref in evidence_refs)


def _collect_use_case_evidence_refs(use_case: SynthesizedUseCase) -> set[str]:
    evidence_refs = set(use_case.evidence_refs)
    for step in use_case.main_flow_steps:
        evidence_refs.update(step.evidence_refs)
    for flow in use_case.alternate_flows:
        evidence_refs.update(flow.evidence_refs)
        for step in flow.steps:
            evidence_refs.update(step.evidence_refs)
    return evidence_refs


def _append_required_trace_issues(
    issues: list[QualityIssue],
    use_case: SynthesizedUseCase,
    feature_intent: FeatureIntent,
) -> None:
    evidence_refs = _collect_use_case_evidence_refs(use_case)
    if feature_intent.inputs or feature_intent.trigger:
        if not (
            _has_evidence_with_prefix(evidence_refs, "feature.inputs.")
            or "feature.trigger" in evidence_refs
        ):
            issues.append(
                QualityIssue(
                    "MISSING_INPUT_TRACE",
                    f"Use case '{use_case.title}' chưa trace rõ inputs hoặc trigger của feature intent.",
                )
            )

    if feature_intent.outputs or feature_intent.success_outcome:
        if not (
            _has_evidence_with_prefix(evidence_refs, "feature.outputs.")
            or "feature.success_outcome" in evidence_refs
        ):
            issues.append(
                QualityIssue(
                    "MISSING_OUTPUT_TRACE",
                    f"Use case '{use_case.title}' chưa trace rõ outputs hoặc success outcome mong đợi.",
                )
            )

    if feature_intent.constraints and not _has_evidence_with_prefix(
        evidence_refs, "feature.constraints."
    ):
        issues.append(
            QualityIssue(
                "MISSING_CONSTRAINT_TRACE",
                f"Use case '{use_case.title}' chưa trace các constraint quan trọng của feature intent.",
            )
        )


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
        if _contains_generic_phrase(
            use_case.title, GENERIC_USE_CASE_BOUNDARY_PHRASES
        ) or _contains_generic_phrase(use_case.objective, GENERIC_USE_CASE_BOUNDARY_PHRASES):
            issues.append(
                QualityIssue(
                    "GENERIC_USE_CASE_BOUNDARY",
                    f"Use case '{use_case.title}' vẫn đang mô tả theo scaffold chung, chưa chốt ranh giới nghiệp vụ cụ thể.",
                )
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
            _append_required_trace_issues(issues, use_case, feature_intent)

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
