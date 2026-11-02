"""Public-facing read schemas (what the SSR pages consume)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.service import CategoryRef


class FaqPublic(BaseModel):
    question: str
    answer: str


class SeoResolved(BaseModel):
    """SEO values resolved server-side: explicit override, else a content-derived
    default. The page renders these directly."""

    title: str
    description: str | None
    og_title: str
    og_description: str | None
    canonical_path: str


class ServiceDetailPublic(BaseModel):
    slug: str
    title: str
    summary: str | None
    description: str | None
    price_rupees: int | None
    price_display: str
    duration_label: str | None
    inclusions: list[str]
    samagri: list[str]
    is_featured: bool
    category: CategoryRef | None
    faqs: list[FaqPublic]
    seo: SeoResolved


class CategoryPublic(BaseModel):
    slug: str
    name: str
    description: str | None
    service_count: int


class ServiceCardPublic(BaseModel):
    slug: str
    title: str
    summary: str | None
    price_display: str
    duration_label: str | None


class CategoryDetailPublic(BaseModel):
    slug: str
    name: str
    description: str | None
    services: list[ServiceCardPublic]
    seo: SeoResolved


class LocationListItem(BaseModel):
    slug: str
    city: str
    region: str | None
    service_count: int


class LocationDetailPublic(BaseModel):
    slug: str
    city: str
    region: str | None
    description: str | None
    services: list[ServiceCardPublic]
    seo: SeoResolved


class TestimonialPublic(BaseModel):
    author_name: str
    author_location: str | None
    service_label: str | None
    quote: str
    rating: int | None


class FaqGroup(BaseModel):
    topic: str
    items: list[FaqPublic]


class PagePublic(BaseModel):
    slug: str
    title: str
    body: str | None
    seo: SeoResolved


class HomepageSectionPublic(BaseModel):
    kind: str
    heading: str | None
    subheading: str | None
    body: str | None
    cta_label: str | None
    cta_href: str | None
    image_url: str | None
    sort_order: int


class SitemapEntry(BaseModel):
    path: str
    lastmod: datetime | None


class RedirectOut(BaseModel):
    to_path: str
    status_code: int
