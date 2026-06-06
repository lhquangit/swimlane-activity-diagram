from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from pydantic import BaseModel


@dataclass(frozen=True)
class ProviderUsage:
    estimated_cost_usd: float | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


@dataclass(frozen=True)
class ProviderResult:
    output: BaseModel
    usage: ProviderUsage


class LLMProvider(Protocol):
    def generate_structured(
        self,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        model: str,
    ) -> ProviderResult: ...
