"""Media Library assets (public website images).

One row per uploaded image. The bytes live in object storage (local dir in dev,
a Supabase bucket in prod) under a server-generated ``storage_key``; the public
site references the image through a stable proxy path (``/api/v1/public/media/
{id}``), never the raw storage key. The original client filename is kept only
for display/search and is never used to build a path.
"""

from __future__ import annotations

from sqlalchemy import BigInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk


class MediaAsset(UUIDPk, Timestamps, Base):
    __tablename__ = "media_asset"

    # Original upload name, sanitized for display and search only.
    filename: Mapped[str] = mapped_column(nullable=False)
    content_type: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # Server-generated object key in the media storage backend. Not public.
    storage_key: Mapped[str] = mapped_column(nullable=False, unique=True)
    # Accessibility / SEO alt text, editable after upload.
    alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Email snapshot of the admin who uploaded it (audit convenience).
    uploaded_by: Mapped[str | None] = mapped_column(nullable=True)
