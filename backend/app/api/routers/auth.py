"""Authentication endpoints: login, refresh, me, logout.

Token model: a short-lived access token is returned in the JSON body (the BFF
frontend stores it in an httpOnly cookie), while the rotating refresh token is
set directly as an httpOnly cookie scoped to the auth path.
"""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, client_ip, get_current_admin
from app.core.config import settings
from app.core.constants import Audit
from app.core.errors import APIError, UnauthorizedError
from app.core.ratelimit import rate_limit
from app.db.session import get_session
from app.schemas.auth import (
    AdminOut,
    LoginRequest,
    MessageResponse,
    RefreshResponse,
    TokenResponse,
)
from app.services import auth_service
from app.services.audit import audit

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

REFRESH_COOKIE = "pje_refresh"
_AUTH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure or settings.is_production,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path=_AUTH_COOKIE_PATH,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    ip = client_ip(request)
    if not await rate_limit(f"login:{ip}", settings.rate_limit_login_per_min):
        raise APIError(
            "Too many login attempts. Please wait a minute.",
            code="rate_limited",
            status_code=429,
        )

    admin = await auth_service.authenticate(
        session, str(payload.email), payload.password, ip=ip
    )
    access, refresh = await auth_service.issue_tokens(session, admin)
    await audit(
        session,
        action=Audit.LOGIN,
        actor_id=str(admin.id),
        actor_email=admin.email,
        ip=ip,
    )

    _set_refresh_cookie(response, refresh)
    return TokenResponse(
        access_token=access,
        user=AdminOut(
            id=str(admin.id),
            email=admin.email,
            full_name=admin.full_name,
            role=admin.role,
            status=admin.status,
        ),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    response: Response,
    session: AsyncSession = Depends(get_session),
    pje_refresh: str | None = Cookie(default=None),
) -> RefreshResponse:
    if not pje_refresh:
        raise UnauthorizedError("Missing refresh token")
    access, new_refresh = await auth_service.rotate_refresh_token(session, pje_refresh)
    _set_refresh_cookie(response, new_refresh)
    return RefreshResponse(access_token=access)


@router.get("/me", response_model=AdminOut)
async def me(admin: CurrentAdmin = Depends(get_current_admin)) -> AdminOut:
    return AdminOut(
        id=admin.id,
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role,
        status=admin.status,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    pje_refresh: str | None = Cookie(default=None),
) -> MessageResponse:
    if pje_refresh:
        await auth_service.revoke_refresh_token(session, pje_refresh)
        await audit(session, action=Audit.LOGOUT, ip=client_ip(request))
    response.delete_cookie(REFRESH_COOKIE, path=_AUTH_COOKIE_PATH)
    return MessageResponse(message="Logged out")
