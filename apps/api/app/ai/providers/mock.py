from __future__ import annotations

from collections.abc import Callable

from pydantic import BaseModel

from .base import ProviderResult, ProviderUsage


class MockProvider:
    def __init__(self, payload_factory: Callable[[], dict]) -> None:
        self._payload_factory = payload_factory

    def generate_structured(
        self,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        model: str,
    ) -> ProviderResult:
        return ProviderResult(
            output=response_schema.model_validate(self._payload_factory()),
            usage=ProviderUsage(
                estimated_cost_usd=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
            ),
        )
