"""Puja category — an optional grouping that powers /puja-categories/[slug]."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, SeoFields, Timestamps, UUIDPk
from app.db.types import GUID


class Category(UUIDPk, Timestamps, Publishable, SeoFields, Base):
    __tablename__ = "category"

    slug: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Thumbnail — same shape as Service (see note there).
    thumbnail_media_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("media_asset.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    thumbnail_url: Mapped[str | None] = mapped_column(nullable=True)
    thumbnail_alt: Mapped[str | None] = mapped_column(nullable=True)
