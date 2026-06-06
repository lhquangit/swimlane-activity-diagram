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

from .deterministic_builder import generate_use_case_drafts
from .grounding import build_grounding_catalog, validate_grounding
from .hydrator import hydrate_synthesis
from .quality import QualityResult, evaluate_synthesis
from .synthesis_schema import UseCaseSynthesisResult


ProviderFactory = Callable[[str, Settings], LLMProvider]
VALID_MODES = {"deterministic", "ai_shadow", "ai_opt_in", "ai_default"}


@dataclass(frozen=True)
class GenerationOutcome:
    use_cases: list[UseCaseDraft]
    metadata: ResponseMetadata
    warnings: list[WarningItem]


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
        preference: str = "auto",
    ) -> GenerationOutcome:
        started_at = perf_counter()
        mode = (
            self._settings.usecase_generation_mode
            if self._settings.usecase_generation_mode in VALID_MODES
            else "deterministic"
        )
        should_attempt_ai = _should_attempt_ai(mode, preference)
        if not should_attempt_ai:
            reason = (
                "user_selected_rule"
                if preference == "deterministic"
                else "ai_not_enabled"
            )
            return self._fallback(
                project_spec, feature_intent, mode, reason, started_at
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
        if provider_name != "mock" and not (
            self._settings.ai_openrouter_api_key
            or self._settings.openrouter_api_key
        ):
            return self._fallback(
                project_spec,
                feature_intent,
                mode,
                "provider_unavailable",
                started_at,
                prompt=prompt,
            )

        try:
            provider = self._provider_factory(provider_name, self._settings)
        except (ValueError, OpenRouterProviderError):
            return self._fallback(
                project_spec,
                feature_intent,
                mode,
                "provider_unavailable",
                started_at,
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
                quality_result = evaluate_synthesis(synthesis)
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
                validation_codes = [
                    "PROVIDER_RETRYABLE" if exc.retryable else "PROVIDER_UNAVAILABLE"
                ]
                if not exc.retryable:
                    break
                continue
            except (TypeError, ValueError) as exc:
                validation_codes = [exc.__class__.__name__.upper()]
                continue

            if mode == "ai_shadow":
                record_generation_event(
                    "shadow_success",
                    capability="usecase_synthesis",
                    provider=provider_name,
                    model=self._settings.usecase_model,
                    prompt_id=prompt.prompt_id,
                    prompt_version=prompt.version,
                    source="deterministic_fallback",
                    quality_status="passed",
                    attempt_count=attempt,
                    use_case_count=len(use_cases),
                )
                return self._fallback(
                    project_spec,
                    feature_intent,
                    mode,
                    "shadow_mode",
                    started_at,
                    prompt=prompt,
                    attempt_count=attempt,
                    usage=provider_usage,
                    shadow_status="passed",
                    quality_result=quality_result,
                )

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

        fallback_reason = (
            "quality_rejected"
            if any(
                code
                not in {"PROVIDER_RETRYABLE", "PROVIDER_UNAVAILABLE"}
                for code in validation_codes
            )
            else "provider_failure"
        )
        return self._fallback(
            project_spec,
            feature_intent,
            mode,
            fallback_reason,
            started_at,
            prompt=prompt,
            attempt_count=self._settings.usecase_max_attempts,
            usage=provider_usage,
            shadow_status="rejected" if mode == "ai_shadow" else None,
            quality_result=quality_result,
        )

    def _fallback(
        self,
        project_spec: ProjectSpec,
        feature_intent: FeatureIntent,
        mode: str,
        reason: str,
        started_at: float,
        *,
        prompt=None,
        attempt_count: int = 0,
        usage: ProviderUsage | None = None,
        shadow_status: str | None = None,
        quality_result: QualityResult | None = None,
    ) -> GenerationOutcome:
        use_cases = generate_use_case_drafts(project_spec, feature_intent)
        usage = usage or ProviderUsage()
        attempted_ai = prompt is not None
        metadata = ResponseMetadata(
            capability="usecase_synthesis",
            provider=self._settings.usecase_provider if attempted_ai else "deterministic",
            model=self._settings.usecase_model if attempted_ai else "spec-usecase-builder-v1",
            generation_source="deterministic_fallback",
            generation_mode=mode,
            fallback_reason=reason,
            prompt_id=prompt.prompt_id if prompt else None,
            prompt_version=prompt.version if prompt else None,
            prompt_fingerprint=prompt.fingerprint if prompt else None,
            quality_status=quality_result.status if quality_result else "not_run",
            quality_score=quality_result.score if quality_result else None,
            shadow_status=shadow_status,
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
            source="deterministic_fallback",
            quality_status=metadata.quality_status,
            fallback_reason=reason,
            attempt_count=attempt_count,
            use_case_count=len(use_cases),
        )
        warning = WarningItem(
            code="USECASE_DETERMINISTIC_FALLBACK",
            severity="info" if reason in {"ai_not_enabled", "user_selected_rule"} else "warning",
            message=_fallback_message(reason),
        )
        return GenerationOutcome(
            use_cases=use_cases, metadata=metadata, warnings=[warning]
        )


def _should_attempt_ai(mode: str, preference: str) -> bool:
    if preference == "deterministic" or mode == "deterministic":
        return False
    if mode == "ai_opt_in":
        return preference == "ai"
    return mode in {"ai_shadow", "ai_default"}


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


def _fallback_message(reason: str) -> str:
    if reason == "user_selected_rule":
        return "Đã tạo bản nháp theo rule như lựa chọn của bạn."
    if reason == "ai_not_enabled":
        return "AI chưa được bật cho môi trường này; bản nháp được tạo theo rule."
    if reason == "shadow_mode":
        return "AI đang chạy ở chế độ đánh giá nền; bản nháp hiển thị vẫn được tạo theo rule."
    if reason == "quality_rejected":
        return "Kết quả AI không qua quality gate; hệ thống đã dùng bản nháp theo rule."
    return "AI tạm thời không khả dụng; hệ thống đã dùng bản nháp theo rule."
