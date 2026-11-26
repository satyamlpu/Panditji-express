"""Shared helpers for the admin content routers."""

from __future__ import annotations

import uuid

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ContentStatus
from app.core.errors import NotFoundError
from app.db.base import utcnow
from app.models.media import MediaAsset
from app.services.revalidate import revalidate_tags


def parse_uuid(value: str, label: str = "Resource") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise NotFoundError(f"{label} not found") from None


async def resolve_media(session: AsyncSession, media_id: str) -> MediaAsset:
    """Load a Media Library asset by id, or 404."""
    try:
        mid = uuid.UUID(media_id)
    except ValueError:
        raise NotFoundError("Media not found") from None
    asset = (
        await session.execute(select(MediaAsset).where(MediaAsset.id == mid))
    ).scalar_one_or_none()
    if asset is None:
        raise NotFoundError("Media not found")
    return asset


async def apply_thumbnail(session: AsyncSession, obj, data: dict) -> None:
    """Resolve a ``thumbnail_media_id`` (set or clear) onto a service/category.

    Only acts when the key is present. Setting it loads the Media Library asset
    and denormalises its display URL + alt onto the entity (so public reads need
    no join); passing null clears the thumbnail. ``thumbnail_alt`` alone updates
    just the alt text of an existing thumbnail.
    """
    if "thumbnail_media_id" in data:
        media_id = data["thumbnail_media_id"]
        if media_id:
            asset = await resolve_media(session, media_id)
            obj.thumbnail_media_id = asset.id
            obj.thumbnail_url = asset.url
            obj.thumbnail_alt = data.get("thumbnail_alt") or asset.alt_text
        else:
            obj.thumbnail_media_id = None
            obj.thumbnail_url = None
            obj.thumbnail_alt = None
    elif "thumbnail_alt" in data and obj.thumbnail_url:
        obj.thumbnail_alt = data.get("thumbnail_alt")


def apply_status_timestamp(obj, data: dict) -> None:
    """Keep ``published_at`` in step with a status transition to published."""
    if (
        "status" in data
        and data["status"] == ContentStatus.PUBLISHED
        and getattr(obj, "published_at", None) is None
    ):
        obj.published_at = utcnow()


def queue_revalidate(bg: BackgroundTasks, tags: list[str]) -> None:
    bg.add_task(revalidate_tags, tags)
