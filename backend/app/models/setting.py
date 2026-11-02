"""Site-wide settings as typed key/value rows.

Holds navigation, footer, social links, contact details and SEO defaults. Each
value is JSON so structured settings (e.g. a nav array) live in one row.
"""

from __future__ import annotations

from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk


class Setting(UUIDPk, Timestamps, Base):
    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    value: Mapped[dict | list | str | int | None] = mapped_column(JSON, nullable=True)
