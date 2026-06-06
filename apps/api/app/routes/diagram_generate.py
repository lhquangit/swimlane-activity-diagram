from __future__ import annotations

from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, Header, Request

from app.rate_limit import InMemoryRateLimiter, parse_rate_limit
from app.runtime_contract import (
    SUPPORTED_SCHEMA_VERSION,
    json_response_from_envelope,
    schema_version_error_response,
)
from app.schemas.common import ErrorObject, ResponseEnvelope, ResponseMetadata
from app.schemas.usecase import DiagramGenerationRequest, DiagramGenerationResult
from app.services.diagram_builder import generate_diagram_draft

router = APIRouter()
rate_limiter = InMemoryRateLimiter(parse_rate_limit("60/minute"))


@router.post("/api/diagrams/generate")
def generate_diagram(
    request: Request,
    payload: DiagramGenerationRequest,
    x_schema_version: str | None = Header(default=None, alias="X-Schema-Version"),
) -> object:
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

    if payload.use_case.review_status != "approved":
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="failed",
            error=ErrorObject(
                code="USE_CASE_NOT_APPROVED",
                message="Use case phai duoc phe duyet truoc khi tao so do.",
                retryable=False,
            ),
        )
        return json_response_from_envelope(envelope, 409)

    started_at = perf_counter()
    result = DiagramGenerationResult(diagram=generate_diagram_draft(payload.use_case))
    envelope = ResponseEnvelope(
        request_id=request_id,
        status="completed",
        result=result.model_dump(mode="json"),
        metadata=ResponseMetadata(
            provider="deterministic",
            model="usecase-diagram-builder-v1",
            latency_ms=int((perf_counter() - started_at) * 1000),
        ),
    )
    return json_response_from_envelope(envelope, 200)
