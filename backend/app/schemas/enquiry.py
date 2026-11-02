"""Booking enquiry schemas: public submission + admin management."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.constants import EnquiryStatus


class EnquiryCreate(BaseModel):
    service_slug: str | None = Field(default=None, max_length=120)
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=120)
    preferred_date: date | None = None
    message: str | None = Field(default=None, max_length=2000)
    # Honeypot — must stay empty. Bots fill every field; humans never see it.
    website: str | None = Field(default=None, max_length=200)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        cleaned = v.strip()
        digits = cleaned.lstrip("+").replace(" ", "").replace("-", "")
        if not digits.isdigit():
            raise ValueError("Enter a valid phone number")
        return cleaned


class EnquiryUpdate(BaseModel):
    status: str | None = None
    admin_notes: str | None = Field(default=None, max_length=4000)

    @field_validator("status")
    @classmethod
    def _status(cls, v: str | None) -> str | None:
        if v is not None and v not in EnquiryStatus.ALL:
            raise ValueError(f"status must be one of {EnquiryStatus.ALL}")
        return v


class EnquiryOut(BaseModel):
    id: str
    service_title_snapshot: str | None
    name: str
    phone: str
    email: str | None
    city: str | None
    preferred_date: date | None
    message: str | None
    status: str
    admin_notes: str | None
    created_at: datetime
