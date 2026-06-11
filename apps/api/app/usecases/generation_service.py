from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from time import perf_counter

from app.ai.prompts import get_prompt
from app.ai.providers import LLMProvider, OpenRouterProviderError, ProviderUsage, build_provider
from app.ai.telemetry import record_generation_event
from app.config import Settings
from app.schemas.common import ResponseMetadata, WarningItem
from app.schemas.usecase import FeatureIntent, ProjectSpec, UseCaseDraft

from .grounding import build_grounding_catalog, validate_grounding
from .hydrator import hydrate_synthesis
from .quality import QualityResult, evaluate_synthesis
from .runtime import normalize_usecase_generation_mode, usecase_ai_provider_available
from .synthesis_schema import UseCaseSynthesisResult


ProviderFactory = Callable[[str, Settings], LLMProvider]
@dataclass(frozen=True)
class GenerationOutcome:
    use_cases: list[UseCaseDraft]
    metadata: ResponseMetadata
    warnings: list[WarningItem]


class UseCaseGenerationFailure(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        retryable: bool,
        status_code: int,
        metadata: ResponseMetadata,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status_code = status_code
        self.metadata = metadata


class UseCaseGenerationService:
    def __init__(
        self,
        settings: Settings,
        provider_factory: ProviderFactory | None = None,
    ) -> None:
        self._settings = settings
        self._provider_factory = provider_factory or (
            lambda provider_name, current_settings: build_provider(
                provider_name, current_settings
            )
        )

    def generate(
        self,
        project_spec: ProjectSpec,
        feature_intent: FeatureIntent,
        preference: str = "ai",
    ) -> GenerationOutcome:
        started_at = perf_counter()
        mode = normalize_usecase_generation_mode(self._settings.usecase_generation_mode)
        if preference != "ai":
            raise self._failure(
                code="USECASE_AI_ONLY_AUTHORING",
                message="Sinh Use Case hiện chỉ hỗ trợ AI authoring.",
                retryable=False,
                status_code=422,
                mode=mode,
                started_at=started_at,
            )
        should_attempt_ai = _should_attempt_ai(mode)
        if not should_attempt_ai:
            raise self._failure(
                code="USECASE_AI_UNAVAILABLE",
                message="AI authoring cho Use Case hiện không khả dụng ở môi trường này.",
                retryable=False,
                status_code=503,
                mode=mode,
                started_at=started_at,
            )

        prompt = get_prompt(
            "usecase_synthesis", self._settings.usecase_prompt_version
        ).render(
            {
                "canonical_input": {
                    "project_spec": project_spec,
                    "feature_intent": feature_intent,
                },
                "evidence_catalog": build_grounding_catalog(
                    project_spec, feature_intent
                ),
                "generation_hints": {
                    "language": "vi",
                    "maximum_use_cases": 8,
                    "technical_ids_are_server_owned": True,
                },
            }
        )
        provider_name = self._settings.usecase_provider
        if provider_name != "mock" and not usecase_ai_provider_available(self._settings):
            raise self._failure(
                code="USECASE_AI_UNAVAILABLE",
                message="AI provider cho Use Case chưa được cấu hình sẵn sàng.",
                retryable=False,
                status_code=503,
                mode=mode,
                started_at=started_at,
                prompt=prompt,
            )

        try:
            provider = self._provider_factory(provider_name, self._settings)
        except (ValueError, OpenRouterProviderError):
            raise self._failure(
                code="USECASE_AI_UNAVAILABLE",
                message="Không thể khởi tạo AI provider cho Use Case.",
                retryable=False,
                status_code=503,
                mode=mode,
                started_at=started_at,
                prompt=prompt,
            )

        provider_usage = ProviderUsage()
        validation_codes: list[str] = []
        quality_result: QualityResult | None = None
        for attempt in range(1, self._settings.usecase_max_attempts + 1):
            user_content = prompt.user_content
            if validation_codes:
                user_content = _append_validation_feedback(user_content, validation_codes)
            try:
                provider_result = provider.generate_structured(
                    prompt.system_prompt,
                    user_content,
                    UseCaseSynthesisResult,
                    self._settings.usecase_model,
                )
                provider_usage = provider_result.usage
                synthesis = UseCaseSynthesisResult.model_validate(provider_result.output)
                grounding_issues = validate_grounding(
                    synthesis, project_spec, feature_intent
                )
                quality_result = evaluate_synthesis(synthesis, feature_intent)
                validation_codes = [
                    *(issue.code for issue in grounding_issues),
                    *(issue.code for issue in quality_result.issues),
                ]
                if validation_codes:
                    record_generation_event(
                        "validation_rejected",
                        capability="usecase_synthesis",
                        provider=provider_name,
                        model=self._settings.usecase_model,
                        prompt_id=prompt.prompt_id,
                        prompt_version=prompt.version,
                        attempt_count=attempt,
                        quality_status=quality_result.status,
                    )
                    continue
                use_cases = hydrate_synthesis(
                    synthesis, project_spec, feature_intent
                )
            except OpenRouterProviderError as exc:
                if not exc.retryable:
                    raise self._failure(
                        code="USECASE_AI_PROVIDER_FAILURE",
                        message=f"AI provider từ chối yêu cầu sinh Use Case: {exc}",
                        retryable=False,
                        status_code=502,
                        mode=mode,
                        started_at=started_at,
                        prompt=prompt,
                        attempt_count=attempt,
                        usage=provider_usage,
                    ) from exc
                validation_codes = ["PROVIDER_RETRYABLE"]
                continue
            except (TypeError, ValueError) as exc:
                validation_codes = [exc.__class__.__name__.upper()]
                continue

            metadata = ResponseMetadata(
                capability="usecase_synthesis",
                provider=provider_name,
                model=self._settings.usecase_model,
                generation_source="ai",
                generation_mode=mode,
                prompt_id=prompt.prompt_id,
                prompt_version=prompt.version,
                prompt_fingerprint=prompt.fingerprint,
                quality_status="passed",
                quality_score=quality_result.score if quality_result else 1.0,
                attempt_count=attempt,
                latency_ms=int((perf_counter() - started_at) * 1000),
                estimated_cost_usd=provider_usage.estimated_cost_usd,
                prompt_tokens=provider_usage.prompt_tokens,
                completion_tokens=provider_usage.completion_tokens,
                total_tokens=provider_usage.total_tokens,
            )
            record_generation_event(
                "success",
                capability="usecase_synthesis",
                provider=provider_name,
                model=self._settings.usecase_model,
                prompt_id=prompt.prompt_id,
                prompt_version=prompt.version,
                source="ai",
                quality_status="passed",
                attempt_count=attempt,
                use_case_count=len(use_cases),
            )
            return GenerationOutcome(use_cases=use_cases, metadata=metadata, warnings=[])

        if any(code != "PROVIDER_RETRYABLE" for code in validation_codes):
            raise self._failure(
                code="USECASE_AI_OUTPUT_REJECTED",
                message="AI đã trả về Use Case không đạt grounding hoặc quality gate.",
                retryable=True,
                status_code=422,
                mode=mode,
                started_at=started_at,
                prompt=prompt,
                attempt_count=self._settings.usecase_max_attempts,
                usage=provider_usage,
                quality_result=quality_result,
            )
        raise self._failure(
            code="USECASE_AI_PROVIDER_FAILURE",
            message="AI provider tạm thời không khả dụng cho Use Case.",
            retryable=True,
            status_code=502,
            mode=mode,
            started_at=started_at,
            prompt=prompt,
            attempt_count=self._settings.usecase_max_attempts,
            usage=provider_usage,
        )

    def _failure(
        self,
        *,
        code: str,
        message: str,
        retryable: bool,
        status_code: int,
        mode: str,
        started_at: float,
        prompt=None,
        attempt_count: int = 0,
        usage: ProviderUsage | None = None,
        quality_result: QualityResult | None = None,
    ) -> UseCaseGenerationFailure:
        usage = usage or ProviderUsage()
        metadata = ResponseMetadata(
            capability="usecase_synthesis",
            provider=self._settings.usecase_provider,
            model=self._settings.usecase_model,
            generation_mode=mode,
            fallback_reason=code,
            prompt_id=prompt.prompt_id if prompt else None,
            prompt_version=prompt.version if prompt else None,
            prompt_fingerprint=prompt.fingerprint if prompt else None,
            quality_status=quality_result.status if quality_result else "not_run",
            quality_score=quality_result.score if quality_result else None,
            attempt_count=attempt_count,
            latency_ms=int((perf_counter() - started_at) * 1000),
            estimated_cost_usd=usage.estimated_cost_usd,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
        )
        record_generation_event(
            "fallback",
            capability="usecase_synthesis",
            provider=metadata.provider,
            model=metadata.model,
            prompt_id=metadata.prompt_id,
            prompt_version=metadata.prompt_version,
            source="failed",
            quality_status=metadata.quality_status,
            fallback_reason=code,
            attempt_count=attempt_count,
            use_case_count=0,
        )
        return UseCaseGenerationFailure(
            code=code,
            message=message,
            retryable=retryable,
            status_code=status_code,
            metadata=metadata,
        )


def _should_attempt_ai(mode: str) -> bool:
    return mode in {"ai_opt_in", "ai_default"}


def _append_validation_feedback(user_content: str, validation_codes: list[str]) -> str:
    return (
        user_content
        + "\n"
        + json.dumps(
            {
                "validation_feedback": {
                    "instruction": "Correct the output without adding unsupported business facts.",
                    "issue_codes": sorted(set(validation_codes)),
                }
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
