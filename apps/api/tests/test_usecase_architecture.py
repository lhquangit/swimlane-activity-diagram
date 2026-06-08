from __future__ import annotations

import inspect

from app.routes import usecase_generate


def test_usecase_route_depends_on_generation_service_not_provider_or_prompt() -> None:
    source = inspect.getsource(usecase_generate)

    assert "UseCaseGenerationService" in source
    assert "OpenRouter" not in source
    assert "get_prompt" not in source
