"""FAQ entries — global (service_id null) or attached to a specific service."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, Timestamps, UUIDPk
from app.db.types import GUID


class Faq(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "faq"

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    topic: Mapped[str | None] = mapped_column(nullable=True, index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("service.id", ondelete="CASCADE"), nullable=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
