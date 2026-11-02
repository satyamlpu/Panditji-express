"""Puja category — an optional grouping that powers /puja-categories/[slug]."""

from __future__ import annotations

from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, SeoFields, Timestamps, UUIDPk


class Category(UUIDPk, Timestamps, Publishable, SeoFields, Base):
    __tablename__ = "category"

    slug: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
