"""Category schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.constants import ContentStatus
from app.schemas.service import SLUG_RE, SeoIn


class CategoryCreate(SeoIn):
    slug: str = Field(pattern=SLUG_RE, max_length=120)
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    sort_order: int = 0
    status: str = ContentStatus.DRAFT

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in ContentStatus.ALL:
            raise ValueError(f"status must be one of {ContentStatus.ALL}")
        return v


class CategoryUpdate(BaseModel):
    slug: str | None = Field(default=None, pattern=SLUG_RE, max_length=120)
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    sort_order: int | None = None
    status: str | None = None
    seo_title: str | None = Field(default=None, max_length=70)
    seo_description: str | None = Field(default=None, max_length=320)
    og_title: str | None = Field(default=None, max_length=90)
    og_description: str | None = Field(default=None, max_length=320)
    canonical_url: str | None = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def _status(cls, v: str | None) -> str | None:
        if v is not None and v not in ContentStatus.ALL:
            raise ValueError(f"status must be one of {ContentStatus.ALL}")
        return v


class CategoryOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    sort_order: int
    status: str
    published_at: datetime | None
    seo_title: str | None
    seo_description: str | None
    og_title: str | None
    og_description: str | None
    canonical_url: str | None
    service_count: int | None = None
    created_at: datetime
    updated_at: datetime
