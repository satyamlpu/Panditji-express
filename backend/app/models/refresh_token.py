"""Persisted refresh tokens, so they can be rotated and revoked.

Only the token id (``jti``) is stored, never the token string itself. On every
refresh the old row is marked revoked and a new one issued (rotation); a reused
revoked token invalidates the chain.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk
from app.db.types import GUID


class RefreshToken(UUIDPk, Timestamps, Base):
    __tablename__ = "refresh_token"

    jti: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    admin_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("admin_user.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
