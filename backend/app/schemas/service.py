"""Service (puja) schemas — separate admin and public shapes.

Money is accepted and returned as whole rupees; it is persisted as paise.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.constants import ContentStatus

SLUG_RE = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class SeoIn(BaseModel):
    seo_title: str | None = Field(default=None, max_length=70)
    seo_description: str | None = Field(default=None, max_length=320)
    og_title: str | None = Field(default=None, max_length=90)
    og_description: str | None = Field(default=None, max_length=320)
    canonical_url: str | None = Field(default=None, max_length=500)


class ServiceCreate(SeoIn):
    slug: str = Field(pattern=SLUG_RE, max_length=120)
    title: str = Field(min_length=2, max_length=160)
    summary: str | None = Field(default=None, max_length=400)
    description: str | None = None
    price_rupees: int | None = Field(default=None, ge=0, le=100_000_000)
    duration_label: str | None = Field(default=None, max_length=60)
    inclusions: list[str] = Field(default_factory=list)
    samagri: list[str] = Field(default_factory=list)
    category_id: str | None = None
    is_featured: bool = False
    sort_order: int = 0
    status: str = ContentStatus.DRAFT

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in ContentStatus.ALL:
            raise ValueError(f"status must be one of {ContentStatus.ALL}")
        return v

    @field_validator("inclusions", "samagri")
    @classmethod
    def _clean_list(cls, v: list[str]) -> list[str]:
        return [s.strip() for s in v if s and s.strip()]


class ServiceUpdate(BaseModel):
    """All fields optional — a partial (PATCH) update."""

    slug: str | None = Field(default=None, pattern=SLUG_RE, max_length=120)
    title: str | None = Field(default=None, min_length=2, max_length=160)
    summary: str | None = Field(default=None, max_length=400)
    description: str | None = None
    price_rupees: int | None = Field(default=None, ge=0, le=100_000_000)
    duration_label: str | None = Field(default=None, max_length=60)
    inclusions: list[str] | None = None
    samagri: list[str] | None = None
    category_id: str | None = None
    is_featured: bool | None = None
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


class CategoryRef(BaseModel):
    id: str
    slug: str
    name: str


class ServiceOut(BaseModel):
    """Full shape for the admin panel."""

    id: str
    slug: str
    title: str
    summary: str | None
    description: str | None
    price_rupees: int | None
    price_display: str
    duration_label: str | None
    inclusions: list[str]
    samagri: list[str]
    category: CategoryRef | None
    is_featured: bool
    sort_order: int
    status: str
    published_at: datetime | None
    seo_title: str | None
    seo_description: str | None
    og_title: str | None
    og_description: str | None
    canonical_url: str | None
    created_at: datetime
    updated_at: datetime


class ServicePublicListItem(BaseModel):
    """Lean shape for the public catalog grid."""

    slug: str
    title: str
    summary: str | None
    price_rupees: int | None
    price_display: str
    duration_label: str | None
    category: CategoryRef | None
    is_featured: bool
