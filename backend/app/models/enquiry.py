"""Booking enquiry submitted from a public booking/contact form.

Personal data (name, phone, email) is collected only to service the enquiry.
A snapshot of the service title/price is stored so the record stays meaningful
even if the service is later renamed or repriced.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import EnquiryStatus
from app.db.base import Base, Timestamps, UUIDPk
from app.db.types import GUID


class BookingEnquiry(UUIDPk, Timestamps, Base):
    __tablename__ = "booking_enquiry"

    service_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("service.id", ondelete="SET NULL"), nullable=True, index=True
    )
    service_title_snapshot: Mapped[str | None] = mapped_column(nullable=True)

    name: Mapped[str] = mapped_column(nullable=False)
    phone: Mapped[str] = mapped_column(nullable=False)
    email: Mapped[str | None] = mapped_column(nullable=True)
    city: Mapped[str | None] = mapped_column(nullable=True)
    preferred_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        default=EnquiryStatus.NEW, nullable=False, index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
