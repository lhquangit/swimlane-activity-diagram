from __future__ import annotations

import time
from uuid import uuid4

from fastapi import APIRouter, Header, Request

from app.rate_limit import InMemoryRateLimiter, parse_rate_limit
from app.runtime_contract import (
    SUPPORTED_SCHEMA_VERSION,
    json_response_from_envelope,
    schema_version_error_response,
)
from app.config import settings
from app.schemas.common import ErrorObject
from app.schemas.common import ResponseEnvelope, ResponseMetadata, ValidationResult
from app.schemas.request import DiagramSemanticRequest
from app.services.extract import extract_request
from app.services.normalize import normalize_request
from app.services.validate import validate_request

router = APIRouter()
rate_limiter = InMemoryRateLimiter(parse_rate_limit(settings.request_rate_limit))


@router.post("/api/brd/validate", response_model=ResponseEnvelope)
def validate_brd_request(
    request: Request,
    payload: DiagramSemanticRequest,
    x_schema_version: str | None = Header(default=None, alias="X-Schema-Version"),
) -> ResponseEnvelope | object:
    request_id = f"req_{uuid4().hex[:12]}"
    if x_schema_version != SUPPORTED_SCHEMA_VERSION:
        return schema_version_error_response(request_id, x_schema_version)
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    allowed, retry_after = rate_limiter.allow(client_ip)
    if not allowed:
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="failed",
            error=ErrorObject(
                code="RATE_LIMITED",
                message=f"Vuot rate limit Phase 1. Thu lai sau khoang {retry_after}s.",
                retryable=True,
            ),
        )
        return json_response_from_envelope(envelope, 429)
    started_at = time.perf_counter()
    extracted = extract_request(payload)
    normalized = normalize_request(extracted)
    warnings, blocking_issues = validate_request(normalized)
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    result = ValidationResult(
        normalized_summary={
            "lane_count": len(normalized.lanes),
            "node_count": len(normalized.nodes),
            "edge_count": len(normalized.edges),
        }
    )
    return ResponseEnvelope(
        request_id=request_id,
        status="blocking" if blocking_issues else "ok",
        warnings=warnings,
        blocking_issues=blocking_issues,
        result=result.model_dump(),
        metadata=ResponseMetadata(latency_ms=latency_ms),
    )
