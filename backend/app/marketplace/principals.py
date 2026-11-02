"""Authentication principals for the marketplace.

Customers and pandits authenticate with phone + OTP and carry a JWT whose
``kind`` claim says which table to resolve. Staff keep the existing email/password
admin login; marketplace staff dependencies reuse that and check the role.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, get_current_admin
from app.core.config import settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import ACCESS, decode_token
from app.db.session import get_session
from app.marketplace.constants import (
    AccountStatus,
    PanditStatus,
    Principal,
    StaffRole,
)
from app.marketplace.models import Customer, Pandit

_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/mp/auth/otp/verify", auto_error=False)


def create_principal_token(principal_id: str, kind: str) -> str:
    """Access token for a customer or pandit, carrying the ``kind`` claim."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(principal_id),
        "kind": kind,
        "type": ACCESS,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _claims(token: str | None, expected_kind: str) -> uuid.UUID:
    if not token:
        raise UnauthorizedError()
    claims = decode_token(token, expected_type=ACCESS)
    if not claims or claims.get("kind") != expected_kind or "sub" not in claims:
        raise UnauthorizedError("Invalid or expired token")
    try:
        return uuid.UUID(str(claims["sub"]))
    except (ValueError, TypeError):
        raise UnauthorizedError("Invalid token subject") from None


@dataclass
class CurrentCustomer:
    id: str
    phone: str
    name: str | None


@dataclass
class CurrentPandit:
    id: str
    phone: str
    name: str | None
    status: str
    availability: str


async def get_current_customer(
    token: str | None = Depends(_scheme),
    session: AsyncSession = Depends(get_session),
) -> CurrentCustomer:
    cid = _claims(token, Principal.CUSTOMER)
    row = (
        await session.execute(select(Customer).where(Customer.id == cid))
    ).scalar_one_or_none()
    if row is None:
        raise UnauthorizedError("Account not found")
    if row.status != AccountStatus.ACTIVE:
        raise ForbiddenError("Account is suspended")
    return CurrentCustomer(id=str(row.id), phone=row.phone, name=row.name)


async def get_current_pandit(
    token: str | None = Depends(_scheme),
    session: AsyncSession = Depends(get_session),
) -> CurrentPandit:
    pid = _claims(token, Principal.PANDIT)
    row = (
        await session.execute(select(Pandit).where(Pandit.id == pid))
    ).scalar_one_or_none()
    if row is None:
        raise UnauthorizedError("Account not found")
    # A suspended partner keeps a valid token but loses all API access until
    # reinstated (status is re-read from the DB, so revocation is immediate).
    if row.status == PanditStatus.SUSPENDED:
        raise ForbiddenError("Account is suspended")
    return CurrentPandit(
        id=str(row.id),
        phone=row.phone,
        name=row.name,
        status=row.status,
        availability=row.availability,
    )


def require_staff(*roles: str):
    """Staff dependency: an authenticated admin whose role is in ``roles``
    (super-admin always allowed). Reuses the existing admin auth."""

    allowed = set(roles) | {StaffRole.SUPER_ADMIN}

    def checker(admin: CurrentAdmin = Depends(get_current_admin)) -> CurrentAdmin:
        if admin.role not in allowed:
            raise ForbiddenError()
        return admin

    return checker


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
