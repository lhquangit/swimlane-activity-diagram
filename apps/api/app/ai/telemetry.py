from __future__ import annotations

import json
import logging
from collections import Counter
from threading import Lock
from typing import Any

logger = logging.getLogger("app.ai")
_COUNTERS: Counter[str] = Counter()
_LOCK = Lock()


def record_generation_event(event: str, **dimensions: Any) -> None:
    with _LOCK:
        _COUNTERS[event] += 1
    safe_dimensions = {
        key: value
        for key, value in dimensions.items()
        if key
        in {
            "capability",
            "provider",
            "model",
            "prompt_id",
            "prompt_version",
            "source",
            "quality_status",
            "fallback_reason",
            "attempt_count",
            "use_case_count",
        }
    }
    logger.info("ai_generation %s", json.dumps({"event": event, **safe_dimensions}))


def counter_snapshot() -> dict[str, int]:
    with _LOCK:
        return dict(_COUNTERS)
