"""Service area (city) and its many-to-many link to services.

Only verified service areas should be published — no auto-generated city pages.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Publishable, SeoFields, Timestamps, UUIDPk
from app.db.types import GUID


class Location(UUIDPk, Timestamps, Publishable, SeoFields, Base):
    __tablename__ = "location"

    slug: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    city: Mapped[str] = mapped_column(nullable=False)
    region: Mapped[str | None] = mapped_column(nullable=True)  # state / area
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ServiceLocation(UUIDPk, Timestamps, Base):
    """Availability of a service in a location, with an optional price override."""

    __tablename__ = "service_location"
    __table_args__ = (
        UniqueConstraint("service_id", "location_id", name="uq_service_location"),
    )

    service_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("service.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("location.id", ondelete="CASCADE"), nullable=False, index=True
    )
    price_paise_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
