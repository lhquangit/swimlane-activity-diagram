from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WarningItem(StrictBaseModel):
    code: str
    severity: Literal["info", "warning", "blocking"]
    message: str
    related_node_ids: list[str] = Field(default_factory=list)


class ErrorObject(StrictBaseModel):
    code: str
    message: str
    retryable: bool = False
    related_node_ids: list[str] = Field(default_factory=list)


class ValidationResult(StrictBaseModel):
    normalized_summary: dict[str, int]


class GenerateResult(StrictBaseModel):
    spec: dict[str, Any]
    brd_markdown: str
    draft_status: str
    review_status: str


class ResponseMetadata(StrictBaseModel):
    provider: str | None = None
    model: str | None = None
    attempt_count: int | None = None
    latency_ms: int | None = None
    estimated_cost_usd: float | None = None
    cached: bool | None = None
    first_request_at: datetime | None = None


class ResponseEnvelope(StrictBaseModel):
    request_id: str
    status: str
    schema_version: str = "2026-05-31"
    warnings: list[WarningItem] = Field(default_factory=list)
    blocking_issues: list[WarningItem] = Field(default_factory=list)
    result: dict[str, Any] = Field(default_factory=dict)
    error: ErrorObject | None = None
    metadata: ResponseMetadata = Field(default_factory=ResponseMetadata)
    idempotency_key: str | None = None
