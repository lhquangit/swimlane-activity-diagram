from __future__ import annotations

from app.schemas.request import DiagramSemanticRequest


def extract_request(payload: DiagramSemanticRequest) -> DiagramSemanticRequest:
    return payload
