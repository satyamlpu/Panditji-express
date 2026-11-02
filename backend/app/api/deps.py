"""Request dependencies: resolve the current admin and enforce access.

The role/status is ALWAYS re-resolved from the database here — never trusted
from the JWT (which carries only the user id) or from the client.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AdminStatus, Role
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import ACCESS, decode_token
from app.db.session import get_session
from app.models.admin_user import AdminUser

# auto_error=False so we raise our own standard-envelope 401s.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@dataclass
class CurrentAdmin:
    id: str
    email: str
    full_name: str | None
    role: str
    status: str


async def get_current_admin(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> CurrentAdmin:
    if not token:
        raise UnauthorizedError()

    claims = decode_token(token, expected_type=ACCESS)
    if not claims or "sub" not in claims:
        raise UnauthorizedError("Invalid or expired token")

    try:
        admin_id = uuid.UUID(str(claims["sub"]))
    except (ValueError, TypeError):
        raise UnauthorizedError("Invalid token subject") from None

    admin = (
        await session.execute(select(AdminUser).where(AdminUser.id == admin_id))
    ).scalar_one_or_none()
    if admin is None:
        raise UnauthorizedError("Account not found")
    if admin.status != AdminStatus.ACTIVE:
        raise ForbiddenError(f"Account is {admin.status}")

    return CurrentAdmin(
        id=str(admin.id),
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role,
        status=admin.status,
    )


def require_admin(admin: CurrentAdmin = Depends(get_current_admin)) -> CurrentAdmin:
    """Deny-by-default: only an active admin may reach protected routes."""
    if admin.role != Role.ADMIN:
        raise ForbiddenError()
    return admin


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
