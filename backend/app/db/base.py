"""Declarative base and shared column mixins (UUID PK, timestamps)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.db.types import GUID


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class UUIDPk:
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class SeoFields:
    """Per-page SEO overrides. When blank the page falls back to sensible
    defaults derived from its own content (title / description)."""

    seo_title: Mapped[str | None] = mapped_column(nullable=True)
    seo_description: Mapped[str | None] = mapped_column(nullable=True)
    og_title: Mapped[str | None] = mapped_column(nullable=True)
    og_description: Mapped[str | None] = mapped_column(nullable=True)
    # Optional canonical override; normally the page self-references.
    canonical_url: Mapped[str | None] = mapped_column(nullable=True)


class Publishable:
    """Publication lifecycle shared by public content."""

    status: Mapped[str] = mapped_column(default="draft", nullable=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
