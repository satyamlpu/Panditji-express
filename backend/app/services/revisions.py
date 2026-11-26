"""Record content revision snapshots for Website Management history.

A thin helper used by the admin content routers: after a create / update /
publish / unpublish, call :func:`record_revision` with a JSON snapshot of the
entity. Versions are per-entity and monotonic. Best-effort and non-fatal — a
history write must never break a content save (it is flushed in the same
session/transaction, so it commits or rolls back with the change).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.revision import ContentRevision


async def record_revision(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: str,
    snapshot: dict | None,
    action: str,
    actor_id: str | None = None,
    actor_email: str | None = None,
) -> None:
    current = (
        await session.execute(
            select(func.max(ContentRevision.version)).where(
                ContentRevision.entity_type == entity_type,
                ContentRevision.entity_id == entity_id,
            )
        )
    ).scalar_one_or_none()
    session.add(
        ContentRevision(
            entity_type=entity_type,
            entity_id=str(entity_id),
            version=(current or 0) + 1,
            action=action,
            snapshot=snapshot,
            actor_id=actor_id,
            actor_email=actor_email,
        )
    )
    await session.flush()
