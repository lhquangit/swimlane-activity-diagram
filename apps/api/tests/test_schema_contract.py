from __future__ import annotations

from app.providers.openrouter_provider import build_openai_strict_schema
from app.schemas.spec import DiagramBRDSpec


def test_diagram_brd_spec_schema_is_openai_strict_compatible() -> None:
    schema = build_openai_strict_schema(DiagramBRDSpec)

    assert schema["additionalProperties"] is False
    assert sorted(schema["required"]) == sorted(schema["properties"].keys())

    defs = schema.get("$defs", {})
    assert defs, "Expected nested schema definitions for strict structured output."

    for name, definition in defs.items():
        if definition.get("type") == "object":
            assert (
                definition.get("additionalProperties") is False
            ), f"{name} must set additionalProperties=false for strict structured output."
            assert sorted(definition.get("required", [])) == sorted(
                definition.get("properties", {}).keys()
            ), f"{name} must mark every property as required for strict structured output."
