"""Append-only audit logging of important admin actions."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def audit(
    session: AsyncSession,
    *,
    action: str,
    actor_id: str | None = None,
    actor_email: str | None = None,
    entity: str | None = None,
    entity_id: str | None = None,
    ip: str | None = None,
    meta: dict | None = None,
) -> None:
    session.add(
        AuditLog(
            action=action,
            actor_id=actor_id,
            actor_email=actor_email,
            entity=entity,
            entity_id=entity_id,
            ip=ip,
            meta=meta,
        )
    )
    await session.flush()
