"""Media Library API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MediaAssetOut(BaseModel):
    id: str
    # Stable public path and absolute URL for the image proxy endpoint.
    path: str
    url: str
    filename: str
    content_type: str
    size_bytes: int
    alt_text: str | None = None
    created_at: datetime


class MediaAltUpdate(BaseModel):
    alt_text: str | None = Field(default=None, max_length=500)
