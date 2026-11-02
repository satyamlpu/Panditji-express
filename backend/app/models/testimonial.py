"""Customer testimonial — only genuine, authorised feedback should be published.

No aggregate rating is exposed as structured data (we do not fabricate review
markup); an optional per-testimonial rating is for display only.
"""

from __future__ import annotations

from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, Timestamps, UUIDPk


class Testimonial(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "testimonial"

    author_name: Mapped[str] = mapped_column(nullable=False)
    author_location: Mapped[str | None] = mapped_column(nullable=True)
    service_label: Mapped[str | None] = mapped_column(nullable=True)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..5, display only
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
