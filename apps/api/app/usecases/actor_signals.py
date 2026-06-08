from __future__ import annotations

TECHNICAL_ACTOR_KEYWORDS = (
    "camera",
    "ai",
    "re-id",
    "reid",
    "model",
    "engine",
    "service",
    "pipeline",
    "detector",
    "tracker",
    "vision",
    "cv",
    "inference",
    "gateway",
    "thiết bị",
    "he thong",
    "hệ thống",
)


def is_technical_actor(value: str) -> bool:
    lowered = value.casefold()
    return any(keyword in lowered for keyword in TECHNICAL_ACTOR_KEYWORDS)
