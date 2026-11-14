"""OTP issuing and verification.

Dev implementation: a 6-digit code is generated, stored hashed with an expiry,
and returned in the response so the flow is testable without a real SMS gateway.
In production the code is sent via the SMS/DLT provider and never returned; the
rest of the flow (expiry, attempt limits, single-use) is identical.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.marketplace.models import OtpCode

OTP_TTL_MINUTES = 5
MAX_VERIFY_ATTEMPTS = 5


def _hash(phone: str, code: str) -> str:
    """Keyed hash of an OTP, bound to the phone.

    HMAC-SHA256 with a server-held pepper (``OTP_PEPPER`` or, failing that,
    ``JWT_SECRET`` — both are required to be non-default in production). Binding
    the phone into the message stops a code hashed for one number matching
    another. A leaked ``otp_code`` table is useless without the server secret.
    """
    key = (settings.otp_pepper or settings.jwt_secret).encode()
    return hmac.new(key, f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


async def issue_otp(session: AsyncSession, phone: str, kind: str) -> str:
    code = f"{secrets.randbelow(900000) + 100000}"
    session.add(
        OtpCode(
            phone=phone,
            kind=kind,
            code_hash=_hash(phone, code),
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
    if not hmac.compare_digest(_hash(phone, code), row.code_hash):
        await session.flush()
        return False

    row.consumed = True
    await session.flush()
    return True
