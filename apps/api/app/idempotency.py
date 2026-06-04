from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class IdempotencyEntry:
    key: str
    payload_hash: str
    state: str
    response_body: dict[str, Any] | None
    status_code: int | None
    created_at: datetime
    expires_at: datetime


class IdempotencyStore:
    def __init__(self, ttl_seconds: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: dict[str, IdempotencyEntry] = {}
        self._lock = Lock()

    def _prune_locked(self) -> None:
        now = utc_now()
        expired_keys = [key for key, entry in self._entries.items() if entry.expires_at <= now]
        for key in expired_keys:
            self._entries.pop(key, None)

    def begin(self, key: str, payload_hash: str) -> tuple[str, IdempotencyEntry | None]:
        with self._lock:
            self._prune_locked()
            existing = self._entries.get(key)
            if existing is None:
                entry = IdempotencyEntry(
                    key=key,
                    payload_hash=payload_hash,
                    state="in_progress",
                    response_body=None,
                    status_code=None,
                    created_at=utc_now(),
                    expires_at=utc_now() + timedelta(seconds=self._ttl_seconds),
                )
                self._entries[key] = entry
                return "new", entry
            if existing.payload_hash != payload_hash:
                return "conflict", existing
            if existing.state == "completed":
                return "replayed", existing
            return "in_progress", existing

    def complete(self, key: str, payload_hash: str, status_code: int, response_body: dict[str, Any]) -> None:
        with self._lock:
            self._prune_locked()
            self._entries[key] = IdempotencyEntry(
                key=key,
                payload_hash=payload_hash,
                state="completed",
                response_body=response_body,
                status_code=status_code,
                created_at=utc_now(),
                expires_at=utc_now() + timedelta(seconds=self._ttl_seconds),
            )

    def release(self, key: str, payload_hash: str) -> None:
        with self._lock:
            self._prune_locked()
            existing = self._entries.get(key)
            if existing and existing.payload_hash == payload_hash and existing.state == "in_progress":
                self._entries.pop(key, None)
