"""301 redirects, created automatically when a content slug changes.

Keeps old URLs working (and their SEO value) after an editor renames a slug.
"""

from __future__ import annotations

from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk


class Redirect(UUIDPk, Timestamps, Base):
    __tablename__ = "redirect"

    from_path: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    to_path: Mapped[str] = mapped_column(nullable=False)
    status_code: Mapped[int] = mapped_column(default=301, nullable=False)
