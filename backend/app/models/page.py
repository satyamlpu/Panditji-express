"""Editable long-form pages: about, contact, and the policy pages.

The body is Markdown so an editor can format without touching code; it is
rendered to sanitised HTML on the public side.
"""

from __future__ import annotations

from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, SeoFields, Timestamps, UUIDPk


class Page(UUIDPk, Timestamps, Publishable, SeoFields, Base):
    __tablename__ = "page"

    slug: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)  # Markdown
