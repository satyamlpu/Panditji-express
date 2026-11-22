"""Mobile app releases shown on the public /download page and managed in CRM.

One row per (app_type, platform, channel) published build. The public site only
ever sees rows with ``is_active = True`` and never raw internal fields; a store
link or APK URL is provided only when a real build exists (no placeholder URLs).
"""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk


class AppRelease(UUIDPk, Timestamps, Base):
    __tablename__ = "app_release"

    app_type: Mapped[str] = mapped_column(nullable=False, index=True)  # customer | partner
    platform: Mapped[str] = mapped_column(nullable=False)  # android | ios
    channel: Mapped[str] = mapped_column(default="beta", nullable=False)  # beta | production
    version: Mapped[str] = mapped_column(nullable=False)  # semver, e.g. 1.2.0
    build_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # The real download target (Play/App Store listing, signed APK URL, or
    # TestFlight invite). NULL = no build yet → the site shows an accurate
    # "coming soon" state rather than a dead link.
    download_url: Mapped[str | None] = mapped_column(nullable=True)
    # SHA-256 of a signed APK, so the site/user can verify the download.
    checksum_sha256: Mapped[str | None] = mapped_column(nullable=True)
    release_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_supported_version: Mapped[str | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
