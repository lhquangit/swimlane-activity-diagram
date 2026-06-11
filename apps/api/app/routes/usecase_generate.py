from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Header, Request

from app.config import settings
from app.rate_limit import InMemoryRateLimiter, parse_rate_limit
from app.runtime_contract import (
    SUPPORTED_SCHEMA_VERSION,
    json_response_from_envelope,
    schema_version_error_response,
)
from app.schemas.common import ErrorObject, ResponseEnvelope
from app.schemas.usecase import UseCaseGenerationRequest, UseCaseGenerationResult
from app.usecases.artifact_chain import build_artifact_chain
from app.usecases.generation_service import UseCaseGenerationFailure, UseCaseGenerationService

router = APIRouter()
rate_limiter = InMemoryRateLimiter(parse_rate_limit("60/minute"))
generation_service = UseCaseGenerationService(settings)


@router.post("/api/usecases/generate")
def generate_use_cases(
    request: Request,
    payload: UseCaseGenerationRequest,
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

    try:
        outcome = generation_service.generate(
            payload.project_spec,
            payload.feature_intent,
            payload.generation_preference,
        )
    except UseCaseGenerationFailure as exc:
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="failed",
            error=ErrorObject(
                code=exc.code,
                message=exc.message,
                retryable=exc.retryable,
            ),
            metadata=exc.metadata,
        )
        return json_response_from_envelope(envelope, exc.status_code)
    result = UseCaseGenerationResult(
        generation_source=outcome.metadata.generation_source or "ai",
        artifact_chain=build_artifact_chain(),
        project_spec=payload.project_spec,
        feature_intent=payload.feature_intent,
        use_cases=outcome.use_cases,
    )
    envelope = ResponseEnvelope(
        request_id=request_id,
        status="completed",
        warnings=outcome.warnings,
        result=result.model_dump(mode="json"),
        metadata=outcome.metadata,
    )
    return json_response_from_envelope(envelope, 200)
