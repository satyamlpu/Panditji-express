"""Admin create/update/out schemas for the remaining content types."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.service import SLUG_RE, SeoIn

Status = Literal["draft", "published", "unpublished"]


# ── Locations ────────────────────────────────────────────────────────────────
class LocationCreate(SeoIn):
    slug: str = Field(pattern=SLUG_RE, max_length=120)
    city: str = Field(min_length=2, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    description: str | None = None
    sort_order: int = 0
    status: Status = "draft"


class LocationUpdate(BaseModel):
    slug: str | None = Field(default=None, pattern=SLUG_RE, max_length=120)
    city: str | None = Field(default=None, min_length=2, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    description: str | None = None
    sort_order: int | None = None
    status: Status | None = None
    seo_title: str | None = Field(default=None, max_length=70)
    seo_description: str | None = Field(default=None, max_length=320)


class LocationOut(BaseModel):
    id: str
    slug: str
    city: str
    region: str | None
    description: str | None
    sort_order: int
    status: str
    seo_title: str | None
    seo_description: str | None
    service_ids: list[str]
    created_at: datetime
    updated_at: datetime


class ServiceAssociationUpdate(BaseModel):
    """Replace the full set of services available in a location."""

    service_ids: list[str] = Field(default_factory=list)


# ── Testimonials ─────────────────────────────────────────────────────────────
class TestimonialCreate(BaseModel):
    author_name: str = Field(min_length=2, max_length=120)
    author_location: str | None = Field(default=None, max_length=120)
    service_label: str | None = Field(default=None, max_length=160)
    quote: str = Field(min_length=4)
    rating: int | None = Field(default=None, ge=1, le=5)
    sort_order: int = 0
    status: Status = "draft"


class TestimonialUpdate(BaseModel):
    author_name: str | None = Field(default=None, min_length=2, max_length=120)
    author_location: str | None = Field(default=None, max_length=120)
    service_label: str | None = Field(default=None, max_length=160)
    quote: str | None = Field(default=None, min_length=4)
    rating: int | None = Field(default=None, ge=1, le=5)
    sort_order: int | None = None
    status: Status | None = None


class TestimonialOut(BaseModel):
    id: str
    author_name: str
    author_location: str | None
    service_label: str | None
    quote: str
    rating: int | None
    sort_order: int
    status: str
    created_at: datetime


# ── FAQs ─────────────────────────────────────────────────────────────────────
class FaqCreate(BaseModel):
    question: str = Field(min_length=4)
    answer: str = Field(min_length=1)
    topic: str | None = Field(default=None, max_length=80)
    service_id: str | None = None
    sort_order: int = 0
    status: Status = "published"


class FaqUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=4)
    answer: str | None = Field(default=None, min_length=1)
    topic: str | None = Field(default=None, max_length=80)
    service_id: str | None = None
    sort_order: int | None = None
    status: Status | None = None


class FaqOut(BaseModel):
    id: str
    question: str
    answer: str
    topic: str | None
    service_id: str | None
    sort_order: int
    status: str


# ── Pages ────────────────────────────────────────────────────────────────────
class PageCreate(SeoIn):
    slug: str = Field(pattern=SLUG_RE, max_length=120)
    title: str = Field(min_length=2, max_length=160)
    body: str | None = None
    status: Status = "draft"


class PageUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    body: str | None = None
    status: Status | None = None
    seo_title: str | None = Field(default=None, max_length=70)
    seo_description: str | None = Field(default=None, max_length=320)


class PageOut(BaseModel):
    id: str
    slug: str
    title: str
    body: str | None
    status: str
    seo_title: str | None
    seo_description: str | None
    updated_at: datetime


# ── Homepage sections / banners ──────────────────────────────────────────────
class BannerCreate(BaseModel):
    kind: str = Field(default="promo", max_length=40)
    heading: str | None = Field(default=None, max_length=200)
    subheading: str | None = None
    body: str | None = None
    cta_label: str | None = Field(default=None, max_length=60)
    cta_href: str | None = Field(default=None, max_length=300)
    image_url: str | None = Field(default=None, max_length=500)
    sort_order: int = 0
    status: Status = "draft"


class BannerUpdate(BaseModel):
    kind: str | None = Field(default=None, max_length=40)
    heading: str | None = Field(default=None, max_length=200)
    subheading: str | None = None
    body: str | None = None
    cta_label: str | None = Field(default=None, max_length=60)
    cta_href: str | None = Field(default=None, max_length=300)
    image_url: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None
    status: Status | None = None


class BannerOut(BaseModel):
    id: str
    kind: str
    heading: str | None
    subheading: str | None
    body: str | None
    cta_label: str | None
    cta_href: str | None
    image_url: str | None
    sort_order: int
    status: str


# ── Settings ─────────────────────────────────────────────────────────────────
class SettingUpdate(BaseModel):
    value: dict | list | str | int | float | bool | None = None
