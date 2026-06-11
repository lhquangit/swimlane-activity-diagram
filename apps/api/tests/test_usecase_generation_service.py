from __future__ import annotations

from app.ai.providers import MockProvider, OpenRouterProviderError
from app.config import Settings
from app.usecases.generation_service import (
    UseCaseGenerationFailure,
    UseCaseGenerationService,
)
from app.usecases.runtime import describe_usecase_generation_runtime

from test_usecase_synthesis import project_and_intent, valid_synthesis_payload


def service_for(
    mode: str,
    payload: dict | None = None,
    *,
    provider_factory=None,
) -> UseCaseGenerationService:
    settings = Settings(
        usecase_provider="mock",
        usecase_generation_mode=mode,
        usecase_model="mock/usecase-model",
        usecase_max_attempts=2,
        ai_openrouter_api_key="sk-test",
        openrouter_api_key="sk-test",
    )
    factory = provider_factory or (
        lambda _name, _settings: MockProvider(lambda: payload or valid_synthesis_payload())
    )
    return UseCaseGenerationService(settings, provider_factory=factory)


def test_ai_authoring_returns_validated_ai_draft() -> None:
    project, intent = project_and_intent()
    outcome = service_for("ai_default").generate(project, intent, "ai")

    assert outcome.metadata.generation_source == "ai"
    assert outcome.metadata.prompt_id == "usecase_synthesis"
    assert outcome.metadata.prompt_version == "1.2.0"
    assert outcome.metadata.quality_status == "passed"
    assert outcome.use_cases[0].title == "Ban quản lý cấp phát thiết bị GPS"


def test_generation_rejects_non_ai_preference() -> None:
    project, intent = project_and_intent()

    try:
        service_for("ai_default").generate(project, intent, "auto")
    except UseCaseGenerationFailure as exc:
        assert exc.code == "USECASE_AI_ONLY_AUTHORING"
        assert exc.status_code == 422
    else:
        raise AssertionError("Expected AI-only authoring failure")


def test_generation_fails_closed_when_runtime_disables_ai_authoring() -> None:
    project, intent = project_and_intent()

    try:
        service_for("deterministic").generate(project, intent, "ai")
    except UseCaseGenerationFailure as exc:
        assert exc.code == "USECASE_AI_UNAVAILABLE"
        assert exc.status_code == 503
    else:
        raise AssertionError("Expected AI unavailable failure")


def test_ai_quality_rejection_retries_then_fails_closed() -> None:
    project, intent = project_and_intent()
    payload = valid_synthesis_payload()
    for step in payload["use_cases"][0]["main_flow_steps"]:
        step["action"] = "Hệ thống xử lý yêu cầu"

    try:
        service_for("ai_default", payload).generate(project, intent, "ai")
    except UseCaseGenerationFailure as exc:
        assert exc.code == "USECASE_AI_OUTPUT_REJECTED"
        assert exc.status_code == 422
        assert exc.metadata.attempt_count == 2
        assert exc.metadata.quality_status == "rejected"
    else:
        raise AssertionError("Expected AI output rejection")


def test_provider_auth_failure_fails_closed_without_scaffold() -> None:
    project, intent = project_and_intent()

    def provider_factory(_name, _settings):
        class FailingProvider:
            def generate_structured(self, *_args, **_kwargs):
                raise OpenRouterProviderError("OpenRouter HTTP 401: User not found.", retryable=False)

        return FailingProvider()

    try:
        service_for("ai_default", provider_factory=provider_factory).generate(project, intent, "ai")
    except UseCaseGenerationFailure as exc:
        assert exc.code == "USECASE_AI_PROVIDER_FAILURE"
        assert exc.status_code == 502
        assert exc.retryable is False
    else:
        raise AssertionError("Expected provider auth failure")


def test_runtime_descriptor_marks_deterministic_mode_as_unavailable() -> None:
    runtime = describe_usecase_generation_runtime(
        Settings(
            usecase_provider="openrouter",
            usecase_generation_mode="deterministic",
            openrouter_api_key="sk-test",
        )
    )

    assert runtime.status == "unavailable"
    assert runtime.can_generate is False
    assert "AI authoring" in runtime.note


def test_runtime_descriptor_blocks_ai_surface_when_provider_is_not_configured() -> None:
    runtime = describe_usecase_generation_runtime(
        Settings(
            usecase_provider="openrouter",
            usecase_generation_mode="ai_default",
            ai_openrouter_api_key="",
            openrouter_api_key="",
        )
    )

    assert runtime.status == "unavailable"
    assert runtime.can_generate is False
    assert "chưa khả dụng" in runtime.note
