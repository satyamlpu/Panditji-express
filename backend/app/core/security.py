"""Password hashing (Argon2id) and JWT issuing / verification.

Critical rule: the access token payload carries ONLY the user id. The role is
re-read from the database on every privileged request — never trusted from the
token or the client. Adapted from the FlowDesk foundation.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error

from app.core.config import settings

# Argon2id is the default variant of argon2-cffi's PasswordHasher.
_hasher = PasswordHasher()

ACCESS = "access"
REFRESH = "refresh"

# A fixed, valid Argon2 hash to verify against for unknown accounts, so a login
# attempt costs the same whether or not the email exists (reduces enumeration).
_DUMMY_HASH = _hasher.hash("panditji-dummy-password")


# ── Passwords ────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """True iff the password matches. Never raises on a bad password/hash."""
    try:
        return _hasher.verify(hashed, password)
    except Argon2Error:
        return False


def needs_rehash(hashed: str) -> bool:
    try:
        return _hasher.check_needs_rehash(hashed)
    except Argon2Error:
        return False


def dummy_verify() -> None:
    """Spend the hashing cost for an unknown-email login (timing equalisation)."""
    verify_password("panditji-dummy-password", _DUMMY_HASH)


# ── JWT ────────────────────────────────────────────────────────────────────--
def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(user_id: str) -> str:
    now = _now()
    payload = {
        "sub": str(user_id),
        "type": ACCESS,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str, jti: str) -> tuple[str, datetime]:
    """Return (token, expires_at). `jti` is persisted so it can be rotated/revoked."""
    now = _now()
    expires = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "type": REFRESH,
        "iat": now,
        "exp": expires,
        "jti": jti,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any] | None:
    """Decode + verify signature and expiry. Returns claims, or None if invalid."""
    try:
        claims = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None
    if expected_type and claims.get("type") != expected_type:
        return None
    return claims


def new_jti() -> str:
    return uuid.uuid4().hex
