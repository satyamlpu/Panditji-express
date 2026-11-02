"""Append-only audit log of important admin actions."""

from __future__ import annotations

import uuid

from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk
from app.db.types import GUID


class AuditLog(UUIDPk, Timestamps, Base):
    __tablename__ = "audit_log"

    action: Mapped[str] = mapped_column(index=True, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    actor_email: Mapped[str | None] = mapped_column(nullable=True)
    entity: Mapped[str | None] = mapped_column(nullable=True)
    entity_id: Mapped[str | None] = mapped_column(nullable=True)
    ip: Mapped[str | None] = mapped_column(nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
