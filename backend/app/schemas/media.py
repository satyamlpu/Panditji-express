"""Media Library schemas (admin + the shape embedded in public thumbnails)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MediaAssetOut(BaseModel):
    id: str
    url: str
    thumb_url: str | None = None
    filename: str
    content_type: str
    byte_size: int
    width: int | None = None
    height: int | None = None
    alt_text: str | None = None
    created_at: datetime
    updated_at: datetime


class MediaUploadResult(MediaAssetOut):
    """Upload response — the created asset plus any advisory warnings.

    ``url`` is also the field the inline image picker consumes, so the shape is
    backward-compatible with the previous simple upload endpoint.
    """

    warnings: list[str] = Field(default_factory=list)


class MediaListResponse(BaseModel):
    items: list[MediaAssetOut]
    total: int
    page: int
    page_size: int


class MediaUpdate(BaseModel):
    alt_text: str | None = Field(default=None, max_length=300)


class MediaUsage(BaseModel):
    """Where an asset is referenced — surfaced before a delete is allowed."""

    services: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)


class ThumbnailPublic(BaseModel):
    """Compact thumbnail embedded in public service/category payloads."""

    url: str
    thumb_url: str | None = None
    alt: str | None = None
