from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.config import Settings


VALID_USECASE_GENERATION_MODES = {
    "deterministic",
    "ai_shadow",
    "ai_opt_in",
    "ai_default",
}


UseCaseGenerationMode = Literal["deterministic", "ai_shadow", "ai_opt_in", "ai_default"]
UseCaseGenerationRuntimeStatus = Literal["available", "degraded", "unavailable"]


@dataclass(frozen=True)
class UseCaseGenerationRuntimeDescriptor:
    status: UseCaseGenerationRuntimeStatus
    provider: str
    prompt_version: str
    can_generate: bool
    note: str


def normalize_usecase_generation_mode(raw_mode: str) -> UseCaseGenerationMode:
    if raw_mode in VALID_USECASE_GENERATION_MODES:
        return raw_mode
    return "deterministic"


def usecase_ai_provider_available(settings: Settings) -> bool:
    if settings.usecase_provider == "mock":
        return False
    if settings.usecase_provider == "openrouter":
        return bool(settings.ai_openrouter_api_key or settings.openrouter_api_key)
    return False


def describe_usecase_generation_runtime(
    settings: Settings,
) -> UseCaseGenerationRuntimeDescriptor:
    effective_mode = normalize_usecase_generation_mode(settings.usecase_generation_mode)
    ai_available = usecase_ai_provider_available(settings)

    if effective_mode == "deterministic":
        return UseCaseGenerationRuntimeDescriptor(
            status="unavailable",
            provider=settings.usecase_provider,
            prompt_version=settings.usecase_prompt_version,
            can_generate=False,
            note="AI authoring cho Use Case đang bị tắt ở môi trường này.",
        )

    if not ai_available:
        return UseCaseGenerationRuntimeDescriptor(
            status="unavailable",
            provider=settings.usecase_provider,
            prompt_version=settings.usecase_prompt_version,
            can_generate=False,
            note="AI authoring cho Use Case chưa khả dụng ở môi trường này.",
        )

    if effective_mode == "ai_shadow":
        return UseCaseGenerationRuntimeDescriptor(
            status="degraded",
            provider=settings.usecase_provider,
            prompt_version=settings.usecase_prompt_version,
            can_generate=False,
            note="AI đang ở chế độ đánh giá nền; môi trường này chưa cho phép authoring Use Case để người dùng sử dụng.",
        )

    return UseCaseGenerationRuntimeDescriptor(
        status="available",
        provider=settings.usecase_provider,
        prompt_version=settings.usecase_prompt_version,
        can_generate=True,
        note="AI đã sẵn sàng để sinh Use Case cho feature hiện tại.",
    )
