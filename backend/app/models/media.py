"""MediaAsset — the central Media Library record for PUBLIC marketing images.

One row per uploaded image (service/category thumbnails, homepage and banner
art). The bytes live in the configured public media store (local ``/uploads``
or a public Supabase bucket, see ``app/services/media_storage.py``); this row
holds the metadata the admin Media Library needs (filename, type, dimensions,
alt text) plus the storage keys required to serve, re-optimise and safely
delete the object.

Marketing media is deliberately kept apart from the PRIVATE KYC documents
(``app/marketplace/storage.py``): different store, different bucket, different
access model (public URL vs. authenticated proxy).
"""

from __future__ import annotations

import uuid

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk
from app.db.types import GUID


class MediaAsset(UUIDPk, Timestamps, Base):
    __tablename__ = "media_asset"

    # Which store holds the bytes ("local" | "supabase"), captured at upload so
    # deletion/serving knows where to look even if the default later changes.
    storage_backend: Mapped[str] = mapped_column(
        String, default="local", nullable=False
    )
    # Server-generated object key of the optimised DISPLAY variant (never the
    # client filename). Relative to the store root.
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    # Key of the preserved ORIGINAL bytes (so we can re-derive variants later).
    original_key: Mapped[str | None] = mapped_column(String, nullable=True)
    # Key of the small thumbnail variant.
    thumb_key: Mapped[str | None] = mapped_column(String, nullable=True)

    # Public URLs. ``url`` is the display variant shown everywhere; ``thumb_url``
    # is a lighter variant for grids/lists. Absolute (backend origin) for local,
    # public object URL for supabase/CDN.
    url: Mapped[str] = mapped_column(String, nullable=False)
    thumb_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Human-facing metadata.
    filename: Mapped[str] = mapped_column(String, nullable=False)  # original name
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
