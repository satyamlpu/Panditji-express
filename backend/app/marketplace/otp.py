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

from app.core.config import canon_phone, settings
from app.core.errors import ForbiddenError
from app.marketplace.models import OtpCode
from app.marketplace.sms import send_otp_sms

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
    """Issue an OTP under the configured provider.

    - "mock" (dev/staging): a fixed test code (``OTP_TEST_CODE``) is stored and
      no SMS is sent. When an allowlist (``OTP_TEST_NUMBERS``) is configured,
      only those numbers may request one.
    - "sms" (production): a random code is stored and sent via MSG91; delivery
      fails closed (raises) when the provider is unavailable, rolling back the
      stored code with the request transaction.

    Expiry, single-use and verify-attempt limits are identical in both modes.
    """
    mode = settings.otp_effective_mode
    if mode == "mock":
        allow = settings.otp_test_number_set
        if allow and canon_phone(phone) not in allow:
            raise ForbiddenError(
                "This number is not an authorized test number for the testing "
                "environment."
            )
        code = settings.otp_test_code
    else:  # "sms"
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

    if mode == "sms":
        await send_otp_sms(phone, code)  # fail-closed on delivery failure

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
