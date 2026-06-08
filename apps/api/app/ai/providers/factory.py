from __future__ import annotations

from collections.abc import Callable

from app.config import Settings

from .base import LLMProvider
from .mock import MockProvider
from .openrouter import OpenRouterProvider


def build_provider(
    provider_name: str,
    settings: Settings,
    mock_payload_factory: Callable[[], dict] | None = None,
    openrouter_provider_factory: Callable[[Settings], LLMProvider] = OpenRouterProvider,
) -> LLMProvider:
    if provider_name == "mock":
        if mock_payload_factory is None:
            raise ValueError("mock_payload_factory is required for mock provider.")
        return MockProvider(mock_payload_factory)
    if provider_name == "openrouter":
        return openrouter_provider_factory(settings)
    raise ValueError(f"Unsupported AI provider: {provider_name}")
