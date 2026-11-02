"""Service (puja) — the central catalog entity.

Price is stored in paise (integer) to avoid floating-point money errors, and
presented in rupees by the API. Inclusions and samagri are ordered string lists
stored as JSON so an editor can manage them freely without schema changes.
"""

from __future__ import annotations

import uuid

from sqlalchemy import JSON, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, SeoFields, Timestamps, UUIDPk
from app.db.types import GUID


class Service(UUIDPk, Timestamps, Publishable, SeoFields, Base):
    __tablename__ = "service"

    slug: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Money in paise. None means "price on request".
    price_paise: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_label: Mapped[str | None] = mapped_column(nullable=True)  # e.g. "2–3 hours"

    inclusions: Mapped[list | None] = mapped_column(JSON, nullable=True)  # list[str]
    samagri: Mapped[list | None] = mapped_column(JSON, nullable=True)  # list[str]

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("category.id", ondelete="SET NULL"), nullable=True, index=True
    )

    is_featured: Mapped[bool] = mapped_column(default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
