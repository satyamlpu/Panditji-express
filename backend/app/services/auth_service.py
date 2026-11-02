"""Authentication service: credential check and refresh-token rotation.

Refresh tokens are persisted by ``jti`` so they can be rotated and revoked. A
presented refresh token is valid only if its jti exists, is not revoked, and has
not expired; on use it is revoked and replaced (rotation).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AdminStatus
from app.core.errors import UnauthorizedError
from app.core.security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    dummy_verify,
    hash_password,
    needs_rehash,
    new_jti,
    verify_password,
)
from app.models.admin_user import AdminUser
from app.models.refresh_token import RefreshToken


async def authenticate(
    session: AsyncSession, email: str, password: str, *, ip: str
) -> AdminUser:
    admin = (
        await session.execute(
            select(AdminUser).where(AdminUser.email == email.lower().strip())
        )
    ).scalar_one_or_none()

    if admin is None:
        dummy_verify()  # equalise timing for unknown accounts
        raise UnauthorizedError("Invalid email or password")

    if not verify_password(password, admin.password_hash):
        raise UnauthorizedError("Invalid email or password")

    if admin.status != AdminStatus.ACTIVE:
        raise UnauthorizedError("Account is disabled")

    # Opportunistic rehash if Argon2 parameters have since strengthened.
    if needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(password)
        await session.flush()

    return admin


async def issue_tokens(session: AsyncSession, admin: AdminUser) -> tuple[str, str]:
    jti = new_jti()
    refresh, expires = create_refresh_token(str(admin.id), jti)
    session.add(RefreshToken(jti=jti, admin_id=admin.id, expires_at=expires))
    await session.flush()
    access = create_access_token(str(admin.id))
    return access, refresh


async def rotate_refresh_token(session: AsyncSession, token: str) -> tuple[str, str]:
    claims = decode_token(token, expected_type=REFRESH)
    if not claims or "jti" not in claims or "sub" not in claims:
        raise UnauthorizedError("Invalid refresh token")

    row = (
        await session.execute(
            select(RefreshToken).where(RefreshToken.jti == claims["jti"])
        )
    ).scalar_one_or_none()

    if row is None or row.revoked:
        raise UnauthorizedError("Refresh token is no longer valid")
    if row.expires_at <= datetime.now(UTC):
        raise UnauthorizedError("Refresh token expired")

    admin = (
        await session.execute(
            select(AdminUser).where(AdminUser.id == row.admin_id)
        )
    ).scalar_one_or_none()
    if admin is None or admin.status != AdminStatus.ACTIVE:
        raise UnauthorizedError("Account unavailable")

    # Rotate: revoke the presented token and issue a fresh pair.
    row.revoked = True
    await session.flush()
    return await issue_tokens(session, admin)


async def revoke_refresh_token(session: AsyncSession, token: str) -> None:
    claims = decode_token(token, expected_type=REFRESH)
    if not claims or "jti" not in claims:
        return
    row = (
        await session.execute(
            select(RefreshToken).where(RefreshToken.jti == claims["jti"])
        )
    ).scalar_one_or_none()
    if row is not None:
        row.revoked = True
        await session.flush()


def _ensure_uuid(value: str) -> uuid.UUID:
    return uuid.UUID(str(value))
