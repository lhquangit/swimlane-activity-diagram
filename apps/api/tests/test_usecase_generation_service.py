from __future__ import annotations

from app.ai.providers import MockProvider
from app.config import Settings
from app.usecases.generation_service import UseCaseGenerationService

from test_usecase_synthesis import project_and_intent, valid_synthesis_payload


def service_for(mode: str, payload: dict | None = None) -> UseCaseGenerationService:
    settings = Settings(
        usecase_provider="mock",
        usecase_generation_mode=mode,
        usecase_model="mock/usecase-model",
        usecase_max_attempts=2,
    )
    return UseCaseGenerationService(
        settings,
        provider_factory=lambda _name, _settings: MockProvider(
            lambda: payload or valid_synthesis_payload()
        ),
    )


def test_deterministic_mode_never_attempts_ai() -> None:
    project, intent = project_and_intent()
    outcome = service_for("deterministic").generate(project, intent, "ai")

    assert outcome.metadata.generation_source == "deterministic_fallback"
    assert outcome.metadata.fallback_reason == "ai_not_enabled"
    assert outcome.metadata.attempt_count == 0


def test_opt_in_mode_returns_validated_ai_draft() -> None:
    project, intent = project_and_intent()
    outcome = service_for("ai_opt_in").generate(project, intent, "ai")

    assert outcome.metadata.generation_source == "ai"
    assert outcome.metadata.prompt_id == "usecase_synthesis"
    assert outcome.metadata.prompt_version == "1.1.0"
    assert outcome.metadata.quality_status == "passed"
    assert outcome.use_cases[0].title == "Ban quản lý cấp phát thiết bị GPS"


def test_ai_quality_rejection_retries_then_falls_back() -> None:
    project, intent = project_and_intent()
    payload = valid_synthesis_payload()
    for step in payload["use_cases"][0]["main_flow_steps"]:
        step["action"] = "Hệ thống xử lý yêu cầu"
    outcome = service_for("ai_default", payload).generate(project, intent)

    assert outcome.metadata.generation_source == "deterministic_fallback"
    assert outcome.metadata.fallback_reason == "quality_rejected"
    assert outcome.metadata.attempt_count == 2
    assert outcome.metadata.quality_status == "rejected"


def test_shadow_mode_evaluates_ai_but_returns_rule_draft() -> None:
    project, intent = project_and_intent()
    outcome = service_for("ai_shadow").generate(project, intent)

    assert outcome.metadata.generation_source == "deterministic_fallback"
    assert outcome.metadata.fallback_reason == "shadow_mode"
    assert outcome.metadata.shadow_status == "passed"


def test_opt_in_mode_auto_preference_keeps_rule_path() -> None:
    project, intent = project_and_intent()
    outcome = service_for("ai_opt_in").generate(project, intent, "auto")

    assert outcome.metadata.generation_source == "deterministic_fallback"
    assert outcome.metadata.fallback_reason == "ai_not_enabled"
