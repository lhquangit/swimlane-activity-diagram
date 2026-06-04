from __future__ import annotations

from fastapi.responses import JSONResponse

from app.schemas.common import ErrorObject, ResponseEnvelope

SUPPORTED_SCHEMA_VERSION = "2026-05-31"


def json_response_from_envelope(envelope: ResponseEnvelope, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=envelope.model_dump(mode="json"))


def schema_version_error_response(request_id: str, provided_version: str | None) -> JSONResponse:
    envelope = ResponseEnvelope(
        request_id=request_id,
        status="failed",
        error=ErrorObject(
            code="INVALID_SCHEMA_VERSION",
            message=(
                f"X-Schema-Version khong hop le. Ho tro duy nhat: {SUPPORTED_SCHEMA_VERSION}. "
                f"Gia tri nhan duoc: {provided_version or '(missing)'}."
            ),
            retryable=False,
        ),
    )
    return json_response_from_envelope(envelope, 400)
