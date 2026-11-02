"""OTP issuing and verification.

Dev implementation: a 6-digit code is generated, stored hashed with an expiry,
and returned in the response so the flow is testable without a real SMS gateway.
In production the code is sent via the SMS/DLT provider and never returned; the
rest of the flow (expiry, attempt limits, single-use) is identical.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.marketplace.models import OtpCode

OTP_TTL_MINUTES = 5
MAX_VERIFY_ATTEMPTS = 5


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def issue_otp(session: AsyncSession, phone: str, kind: str) -> str:
    code = f"{secrets.randbelow(900000) + 100000}"
    session.add(
        OtpCode(
            phone=phone,
            kind=kind,
            code_hash=_hash(code),
            expires_at=datetime.now(UTC) + timedelta(minutes=OTP_TTL_MINUTES),
        )
    )
    await session.flush()
    return code


async def verify_otp(session: AsyncSession, phone: str, kind: str, code: str) -> bool:
    row = (
        await session.execute(
            select(OtpCode)
            .where(
                OtpCode.phone == phone,
                OtpCode.kind == kind,
                OtpCode.consumed.is_(False),
            )
            .order_by(OtpCode.created_at.desc())
        )
    ).scalars().first()

    if row is None:
        return False
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        return False
    if row.attempts >= MAX_VERIFY_ATTEMPTS:
        return False

    row.attempts += 1
    if _hash(code) != row.code_hash:
        await session.flush()
        return False

    row.consumed = True
    await session.flush()
    return True
