from __future__ import annotations

from http.client import IncompleteRead

import pytest
from pydantic import BaseModel

from app.config import Settings
from app.providers.openrouter_provider import OpenRouterProvider
from app.providers.openrouter_provider import OpenRouterProviderError


class TinyResponseSchema(BaseModel):
    value: str


def test_openrouter_provider_maps_incomplete_read_to_retryable_error(monkeypatch) -> None:
    settings = Settings(
        provider="openrouter",
        openrouter_api_key="test-key",
        openrouter_base_url="https://openrouter.ai/api/v1",
        model_primary="openai/gpt-5.5",
    )
    provider = OpenRouterProvider(settings)

    class BrokenChunkedResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def read(self) -> bytes:
            raise IncompleteRead(b'{"id":"partial","choices":[{"message":{"content":"')

    monkeypatch.setattr(
        "app.providers.openrouter_provider.urlopen",
        lambda req, timeout=45: BrokenChunkedResponse(),
    )

    with pytest.raises(OpenRouterProviderError) as exc_info:
        provider.generate_structured(
            system_prompt="system",
            user_content="user",
            response_schema=TinyResponseSchema,
            model="openai/gpt-5.5",
        )

    assert exc_info.value.retryable is True
    assert "không hoàn chỉnh" in str(exc_info.value)
