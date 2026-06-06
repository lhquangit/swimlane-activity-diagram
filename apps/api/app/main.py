from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.brd_generate import router as brd_generate_router
from app.routes.brd_validate import router as brd_validate_router
from app.routes.diagram_generate import router as diagram_generate_router
from app.routes.usecase_generate import router as usecase_generate_router
from app.runtime_contract import json_response_from_envelope
from app.schemas.common import ErrorObject, ResponseEnvelope

app = FastAPI(title="Swimlane BRD API", version="0.1.0")
if settings.ai_log_prompt_body:
    logging.getLogger("app.ai").warning(
        "AI_LOG_PROMPT_BODY is enabled. Do not use this setting with sensitive production data."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Idempotency-Key", "X-Schema-Version"],
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> object:
    request_id = f"req_{uuid4().hex[:12]}"
    first_error = exc.errors()[0] if exc.errors() else {}
    location = ".".join(str(part) for part in first_error.get("loc", []) if part != "body")
    message = first_error.get("msg", "Request validation failed.")
    detail = f"{location}: {message}" if location else message
    envelope = ResponseEnvelope(
        request_id=request_id,
        status="failed",
        error=ErrorObject(
            code="INVALID_REQUEST",
            message=f"Payload khong hop le. {detail}",
            retryable=False,
        ),
    )
    return json_response_from_envelope(envelope, 422)


app.include_router(brd_validate_router)
app.include_router(brd_generate_router)
app.include_router(usecase_generate_router)
app.include_router(diagram_generate_router)
