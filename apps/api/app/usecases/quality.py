from __future__ import annotations

from dataclasses import dataclass

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


def evaluate_synthesis(synthesis: UseCaseSynthesisResult) -> QualityResult:
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

    if total_steps and generic_steps / total_steps >= 0.4:
        issues.append(
            QualityIssue("GENERIC_OUTPUT", "Too many steps use generic filler language.")
        )
    score = max(0.0, 1.0 - (len(issues) * 0.2))
    return QualityResult(status="rejected" if issues else "passed", issues=issues, score=score)
