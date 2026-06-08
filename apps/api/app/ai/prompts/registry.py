from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


PromptCapability = Literal["brd_generation", "usecase_synthesis"]
PROMPT_ASSET_DIR = Path(__file__).resolve().parent / "assets"


@dataclass(frozen=True)
class RenderedPrompt:
    prompt_id: str
    version: str
    capability: PromptCapability
    system_prompt: str
    user_content: str
    fingerprint: str


@dataclass(frozen=True)
class PromptDefinition:
    prompt_id: str
    version: str
    capability: PromptCapability
    system_prompt: str
    input_schema_version: str
    changelog: str

    def render(self, input_data: dict[str, Any]) -> RenderedPrompt:
        user_content = json.dumps(
            {
                "input_schema_version": self.input_schema_version,
                "trust_boundary": "UNTRUSTED_BUSINESS_DATA",
                "business_data": input_data,
            },
            ensure_ascii=False,
            sort_keys=True,
            default=_json_default,
        )
        fingerprint = hashlib.sha256(
            f"{self.prompt_id}:{self.version}:{self.system_prompt}:{user_content}".encode("utf-8")
        ).hexdigest()[:16]
        return RenderedPrompt(
            prompt_id=self.prompt_id,
            version=self.version,
            capability=self.capability,
            system_prompt=self.system_prompt,
            user_content=user_content,
            fingerprint=fingerprint,
        )


def _load_prompt_text(*parts: str) -> str:
    return (PROMPT_ASSET_DIR.joinpath(*parts)).read_text(encoding="utf-8").strip()


BRD_GENERATION_V1 = PromptDefinition(
    prompt_id="brd_generation",
    version="1.0.0",
    capability="brd_generation",
    input_schema_version="2026-05-31",
    changelog="Move the existing BRD instruction into the shared registry.",
    system_prompt=_load_prompt_text("brd_generation", "1.0.0", "system.md"),
)

USECASE_SYNTHESIS_V1 = PromptDefinition(
    prompt_id="usecase_synthesis",
    version="1.0.0",
    capability="usecase_synthesis",
    input_schema_version="2026-06-06",
    changelog="Initial grounded semantic use-case synthesis prompt.",
    system_prompt=_load_prompt_text("usecase_synthesis", "1.0.0", "system.md"),
)

USECASE_SYNTHESIS_V1_1 = PromptDefinition(
    prompt_id="usecase_synthesis",
    version="1.1.0",
    capability="usecase_synthesis",
    input_schema_version="2026-06-06",
    changelog="Preserve canonical technical actors and move use-case prompt assets to markdown files.",
    system_prompt=_load_prompt_text("usecase_synthesis", "1.1.0", "system.md"),
)

_REGISTRY = {
    (BRD_GENERATION_V1.prompt_id, BRD_GENERATION_V1.version): BRD_GENERATION_V1,
    (USECASE_SYNTHESIS_V1.prompt_id, USECASE_SYNTHESIS_V1.version): USECASE_SYNTHESIS_V1,
    (USECASE_SYNTHESIS_V1_1.prompt_id, USECASE_SYNTHESIS_V1_1.version): USECASE_SYNTHESIS_V1_1,
}


def get_prompt(prompt_id: str, version: str) -> PromptDefinition:
    try:
        return _REGISTRY[(prompt_id, version)]
    except KeyError as exc:
        raise KeyError(f"Unknown prompt: {prompt_id}@{version}") from exc


def _json_default(value: Any) -> Any:
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return model_dump(mode="json")
    raise TypeError(f"Object of type {value.__class__.__name__} is not JSON serializable")
