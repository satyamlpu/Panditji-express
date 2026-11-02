"""Homepage sections / promotional banners, ordered and individually publishable."""

from __future__ import annotations

from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, Timestamps, UUIDPk


class HomepageSection(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "homepage_section"

    # e.g. "hero", "promo", "trust", "cta" — decides how the front end renders it
    kind: Mapped[str] = mapped_column(default="promo", nullable=False)
    heading: Mapped[str | None] = mapped_column(nullable=True)
    subheading: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    cta_label: Mapped[str | None] = mapped_column(nullable=True)
    cta_href: Mapped[str | None] = mapped_column(nullable=True)
    image_url: Mapped[str | None] = mapped_column(nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
