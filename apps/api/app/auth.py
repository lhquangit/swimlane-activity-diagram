from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from clerk_backend_api import AuthenticateRequestOptions
from clerk_backend_api.security import authenticate_request
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import AppUser


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    clerk_user_id: str
    role: str


def _claim_text(payload: dict[str, object], key: str) -> str | None:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def get_auth_settings():
    return settings


def authenticate_clerk_request(request: Request):
    auth_settings = get_auth_settings()
    return authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=auth_settings.clerk_secret_key or None,
            jwt_key=auth_settings.clerk_jwt_key or None,
            authorized_parties=auth_settings.clerk_authorized_parties,
            accepts_token=["session_token"],
        ),
    )


def require_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> CurrentUser:
    auth_settings = get_auth_settings()
    if auth_settings.auth_disabled:
        user_id = UUID("00000000-0000-0000-0000-000000000001")
        user = db.get(AppUser, user_id)
        if user is None:
            user = AppUser(
                id=user_id,
                clerk_user_id="test_user",
                email="test@example.com",
                display_name="Test User",
                role="user",
            )
            db.add(user)
            db.commit()
        return CurrentUser(id=user_id, clerk_user_id="test_user", role="user")
    if not auth_settings.clerk_secret_key and not auth_settings.clerk_jwt_key:
        raise HTTPException(status_code=503, detail="Clerk backend authentication is not configured.")

    state = authenticate_clerk_request(request)
    if not state.is_signed_in or not state.payload:
        raise HTTPException(status_code=401, detail="Invalid or missing Clerk session token.")

    clerk_user_id = _claim_text(state.payload, "sub")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Clerk token is missing subject.")

    user = db.scalar(select(AppUser).where(AppUser.clerk_user_id == clerk_user_id))
    if user is None:
        user = AppUser(
            clerk_user_id=clerk_user_id,
            email=_claim_text(state.payload, "email"),
            display_name=_claim_text(state.payload, "name"),
            role="user",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return CurrentUser(id=user.id, clerk_user_id=user.clerk_user_id, role=user.role)


def require_session(request: Request) -> dict[str, object]:
    auth_settings = get_auth_settings()
    if auth_settings.auth_disabled:
        return {"sub": "test_user"}
    if not auth_settings.clerk_secret_key and not auth_settings.clerk_jwt_key:
        raise HTTPException(status_code=503, detail="Clerk backend authentication is not configured.")
    state = authenticate_clerk_request(request)
    if not state.is_signed_in or not state.payload:
        raise HTTPException(status_code=401, detail="Invalid or missing Clerk session token.")
    return state.payload
