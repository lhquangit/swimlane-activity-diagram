from __future__ import annotations

import hashlib
import json
import time
from uuid import uuid4

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.idempotency import IdempotencyStore, utc_now
from app.ai.providers import OpenRouterProvider, OpenRouterProviderError, build_provider
from app.rate_limit import InMemoryRateLimiter, parse_rate_limit
from app.runtime_contract import (
    SUPPORTED_SCHEMA_VERSION,
    json_response_from_envelope,
    schema_version_error_response,
)
from app.schemas.common import ErrorObject, GenerateResult, ResponseEnvelope, ResponseMetadata
from app.schemas.request import GenerateRequest
from app.schemas.spec import DiagramBRDSpec
from app.services.extract import extract_request
from app.services.interpret import interpret_request
from app.services.normalize import normalize_request
from app.services.postcheck import postcheck_spec
from app.services.prompt_builder import build_generation_prompts
from app.services.render import render_brd_markdown
from app.services.spec_builder import build_deterministic_spec, harmonize_generated_spec
from app.services.validate import validate_request

router = APIRouter()
idempotency_store = IdempotencyStore(settings.idempotency_ttl_seconds)
rate_limiter = InMemoryRateLimiter(parse_rate_limit(settings.request_rate_limit))


@router.post("/api/brd/generate")
def generate_brd(
    request: Request,
    payload: GenerateRequest,
    x_schema_version: str | None = Header(default=None, alias="X-Schema-Version"),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
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
    if not idempotency_key:
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="failed",
            error=ErrorObject(
                code="IDEMPOTENCY_KEY_REQUIRED",
                message="Thiếu header Idempotency-Key cho /generate.",
                retryable=False,
            ),
        )
        return json_response_from_envelope(envelope, 400)

    payload_hash = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode("utf-8")
    ).hexdigest()
    idempotency_state, existing_entry = idempotency_store.begin(idempotency_key, payload_hash)
    if idempotency_state == "conflict":
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="conflict",
            idempotency_key=idempotency_key,
            error=ErrorObject(
                code="IDEMPOTENCY_KEY_CONFLICT",
                message="Idempotency-Key đã được dùng cho payload khác.",
                retryable=False,
            ),
        )
        return json_response_from_envelope(envelope, 409)
    if idempotency_state == "replayed" and existing_entry and existing_entry.response_body:
        body = dict(existing_entry.response_body)
        body["status"] = "replayed"
        body["idempotency_key"] = idempotency_key
        body.setdefault("metadata", {})
        body["metadata"]["cached"] = True
        return JSONResponse(status_code=200, content=body)
    if idempotency_state == "in_progress" and existing_entry:
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="in_progress",
            idempotency_key=idempotency_key,
            metadata=ResponseMetadata(
                cached=False,
                first_request_at=existing_entry.created_at,
            ),
        )
        return json_response_from_envelope(envelope, 202)

    release_idempotency = True
    try:
        started_at = time.perf_counter()
        extracted = extract_request(payload)
        normalized = normalize_request(extracted)
        warnings, blocking_issues = validate_request(normalized)
        if blocking_issues:
            envelope = ResponseEnvelope(
                request_id=request_id,
                status="blocking",
                idempotency_key=idempotency_key,
                warnings=warnings,
                blocking_issues=blocking_issues,
                error=ErrorObject(
                    code="VALIDATION_BLOCKING",
                    message="Diagram đang có blocking issue; chưa thể generate BRD.",
                    retryable=False,
                    related_node_ids=sorted(
                        {
                            node_id
                            for issue in blocking_issues
                            for node_id in issue.related_node_ids
                        }
                    ),
                ),
            )
            return json_response_from_envelope(envelope, 422)

        interpreted = interpret_request(normalized, warnings)
        model_name = settings.model_primary
        max_attempts = 1 if settings.provider == "mock" else 2
        deterministic_spec_payload = build_deterministic_spec(
            payload=normalized.model_dump(mode="python"),
            interpreted=interpreted,
            warnings=[warning.model_dump(mode="python") for warning in warnings],
            model_name=model_name,
        )

        def build_mock_payload():
            return deterministic_spec_payload

        if settings.provider != "mock" and not settings.openrouter_api_key:
            envelope = ResponseEnvelope(
                request_id=request_id,
                status="failed",
                idempotency_key=idempotency_key,
                warnings=warnings,
                error=ErrorObject(
                    code="PROVIDER_UNAVAILABLE",
                    message="Backend chưa có AI_OPENROUTER_API_KEY.",
                    retryable=False,
                ),
                metadata=ResponseMetadata(provider=settings.provider, model=model_name),
            )
            return json_response_from_envelope(envelope, 503)
        provider = build_provider(
            settings.provider,
            settings,
            build_mock_payload,
            OpenRouterProvider,
        )

        system_prompt = ""
        user_content = ""
        if settings.provider != "mock":
            system_prompt, user_content = build_generation_prompts(
                normalized.model_dump(mode="python"), interpreted
            )

        provider_result = None
        attempt_count = 0
        provider_error: OpenRouterProviderError | None = None
        for attempt in range(1, max_attempts + 1):
            attempt_count = attempt
            try:
                provider_result = provider.generate_structured(
                    system_prompt,
                    user_content,
                    DiagramBRDSpec,
                    model_name,
                )
                provider_error = None
                break
            except OpenRouterProviderError as exc:
                provider_error = exc
                if not exc.retryable or attempt >= max_attempts:
                    break

        if provider_error is not None or provider_result is None:
            exc = provider_error or OpenRouterProviderError("Unknown provider error.", retryable=False)
            envelope = ResponseEnvelope(
                request_id=request_id,
                status="failed",
                idempotency_key=idempotency_key,
                warnings=warnings,
                error=ErrorObject(
                    code="MODEL_TIMEOUT" if exc.retryable else "PROVIDER_UNAVAILABLE",
                    message=str(exc),
                    retryable=exc.retryable,
                ),
                metadata=ResponseMetadata(
                    provider=settings.provider,
                    model=model_name,
                    attempt_count=attempt_count,
                    latency_ms=int((time.perf_counter() - started_at) * 1000),
                ),
            )
            return json_response_from_envelope(envelope, 502 if exc.retryable else 503)

        traceable_node_ids = interpreted["traceable_node_ids"]
        spec = harmonize_generated_spec(provider_result.output, deterministic_spec_payload)
        postcheck_warnings = postcheck_spec(spec, traceable_node_ids=traceable_node_ids)
        all_warnings = [*warnings, *postcheck_warnings]
        markdown = render_brd_markdown(spec, payload.template)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        estimated_cost = provider_result.usage.estimated_cost_usd
        envelope = ResponseEnvelope(
            request_id=request_id,
            status="completed",
            idempotency_key=idempotency_key,
            warnings=all_warnings,
            result=GenerateResult(
                spec=spec.model_dump(mode="json"),
                brd_markdown=markdown,
                draft_status="Draft",
                review_status="Warnings present" if all_warnings else "No blocking warnings",
            ).model_dump(mode="json"),
            metadata=ResponseMetadata(
                provider=settings.provider,
                model=model_name,
                attempt_count=attempt_count,
                latency_ms=latency_ms,
                estimated_cost_usd=estimated_cost,
                cached=False,
                first_request_at=utc_now(),
            ),
        )
        body = envelope.model_dump(mode="json")
        idempotency_store.complete(idempotency_key, payload_hash, 200, body)
        release_idempotency = False
        return json_response_from_envelope(envelope, 200)
    finally:
        if release_idempotency:
            idempotency_store.release(idempotency_key, payload_hash)
