from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from time import time


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int


def parse_rate_limit(raw: str) -> RateLimitRule:
    value = (raw or "").strip().lower()
    if "/" not in value:
        return RateLimitRule(limit=20, window_seconds=60)
    limit_raw, unit = value.split("/", 1)
    try:
        limit = max(1, int(limit_raw))
    except ValueError:
        return RateLimitRule(limit=20, window_seconds=60)
    unit = unit.strip()
    if unit in {"s", "sec", "second", "seconds"}:
        return RateLimitRule(limit=limit, window_seconds=1)
    if unit in {"h", "hr", "hour", "hours"}:
        return RateLimitRule(limit=limit, window_seconds=3600)
    return RateLimitRule(limit=limit, window_seconds=60)


class InMemoryRateLimiter:
    def __init__(self, rule: RateLimitRule) -> None:
        self._rule = rule
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> tuple[bool, int]:
        now = time()
        threshold = now - self._rule.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= threshold:
                hits.popleft()
            if len(hits) >= self._rule.limit:
                retry_after = max(1, int(self._rule.window_seconds - (now - hits[0])))
                return False, retry_after
            hits.append(now)
            return True, 0
