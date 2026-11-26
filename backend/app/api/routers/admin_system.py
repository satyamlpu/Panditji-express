"""Admin: system observability — content-sync health, audit log, revisions.

* ``GET /system/sync-status`` surfaces whether the publish→reflect pipeline is
  wired (is on-demand revalidation configured? is the frontend webhook
  reachable? what was the last result?) so a misconfiguration is visible in the
  UI rather than silently leaving edits stale.
* ``GET /system/audit`` lists the administrator audit trail.
* ``GET /revisions`` lists the content revision history for one entity.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.config import settings
from app.db.session import get_session
from app.models.audit import AuditLog
from app.models.revision import ContentRevision
from app.schemas.common import Page
from app.services.revalidate import LAST_RESULT, check_revalidation

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin:system"],
    dependencies=[Depends(require_admin)],
)


def _redact_db_url(url: str) -> str:
    """Show the DB host/name without leaking credentials."""
    try:
        if "@" in url:
            scheme, rest = url.split("://", 1)
            _creds, host = rest.split("@", 1)
            return f"{scheme}://***@{host}"
    except ValueError:
        pass
    return url


class SyncStatus(BaseModel):
    revalidation_configured: bool
    frontend_revalidate_url: str
    revalidation_reachable: bool
    revalidation_detail: str
    revalidation_secret_is_default: bool
    last_result: dict | None
    database: str
    media_storage_backend: str
    environment: str


@router.get("/system/sync-status", response_model=SyncStatus)
async def sync_status(test: bool = Query(default=True)) -> SyncStatus:
    """Report the live state of the admin→website sync pipeline."""
    configured = bool(settings.frontend_revalidate_url)
    reachable = False
    detail = "Skipped live probe."
    if test and configured:
        result = await check_revalidation()
        reachable = result.ok
        detail = result.detail
    elif not configured:
        detail = (
            "FRONTEND_REVALIDATE_URL is not set — published changes will only "
            "appear after the time-based ISR window, not immediately."
        )
    return SyncStatus(
        revalidation_configured=configured,
        frontend_revalidate_url=settings.frontend_revalidate_url,
        revalidation_reachable=reachable,
        revalidation_detail=detail,
        revalidation_secret_is_default=(
            settings.revalidate_secret == "change-me-revalidate-secret"
        ),
        last_result=LAST_RESULT.as_dict() if LAST_RESULT else None,
        database=_redact_db_url(settings.database_url),
        media_storage_backend=settings.media_storage_backend,
        environment=settings.app_env,
    )


class AuditEntry(BaseModel):
    id: str
    action: str
    actor_email: str | None
    entity: str | None
    entity_id: str | None
    ip: str | None
    meta: dict | None
    created_at: datetime


@router.get("/system/audit", response_model=Page[AuditEntry])
async def list_audit(
    session: AsyncSession = Depends(get_session),
    entity: str | None = Query(default=None),
    action: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> Page[AuditEntry]:
    where = []
    if entity:
        where.append(AuditLog.entity == entity)
    if action:
        where.append(AuditLog.action == action)
    total = (
        await session.execute(select(func.count()).select_from(AuditLog).where(*where))
    ).scalar_one()
    rows = (
        await session.execute(
            select(AuditLog)
            .where(*where)
            .order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    items = [
        AuditEntry(
            id=str(r.id),
            action=r.action,
            actor_email=r.actor_email,
            entity=r.entity,
            entity_id=r.entity_id,
            ip=r.ip,
            meta=r.meta,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return Page[AuditEntry](items=items, total=total, page=page, page_size=page_size)


class RevisionEntry(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    version: int
    action: str
    snapshot: dict | None
    actor_email: str | None
    created_at: datetime


@router.get("/revisions", response_model=list[RevisionEntry])
async def list_revisions(
    session: AsyncSession = Depends(get_session),
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[RevisionEntry]:
    rows = (
        await session.execute(
            select(ContentRevision)
            .where(
                ContentRevision.entity_type == entity_type,
                ContentRevision.entity_id == entity_id,
            )
            .order_by(ContentRevision.version.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        RevisionEntry(
            id=str(r.id),
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            version=r.version,
            action=r.action,
            snapshot=r.snapshot,
            actor_email=r.actor_email,
            created_at=r.created_at,
        )
        for r in rows
    ]
