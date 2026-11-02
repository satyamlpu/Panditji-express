"""Shared helpers for the admin content routers."""

from __future__ import annotations

import uuid

from fastapi import BackgroundTasks

from app.core.constants import ContentStatus
from app.core.errors import NotFoundError
from app.db.base import utcnow
from app.services.revalidate import revalidate_tags


def parse_uuid(value: str, label: str = "Resource") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise NotFoundError(f"{label} not found") from None


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
