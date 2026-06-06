from __future__ import annotations

from app.ai.prompts import get_prompt


def build_generation_prompts(payload: dict, interpreted: dict) -> tuple[str, str]:
    rendered = get_prompt("brd_generation", "1.0.0").render(
        {"diagram": payload, "interpreted": interpreted}
    )
    return rendered.system_prompt, rendered.user_content
