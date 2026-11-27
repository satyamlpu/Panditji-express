"""Audit-log viewer + Roles & Permissions matrix (governance).

Super-admin-only, read-only windows onto the platform's accountability surface:
- A searchable, filterable, paginated view of the existing append-only
  ``audit_log`` (actor, action, entity, before/after ``meta``, IP, time).
- A static **permissions matrix** that documents which staff role may reach which
  CRM module. It is derived from — and must mirror — the enforced ``require_staff``
  gates in the routers; it does not grant access, it reports it.

Reads here are intentionally **not** themselves audited (a viewer that writes an
audit row on every page would drown the log); only state-changing actions are.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.db.session import get_session
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    AuditLogList,
    AuditLogRow,
    AuditMetaOut,
    PermissionMatrixOut,
    PermissionRow,
)
from app.models.audit import AuditLog

router = APIRouter(prefix="/api/v1/mp/admin/audit", tags=["mp:admin-audit"])

# Super-admin only (no extra roles → allowed == {admin}). Sensitive data.
_admin = Depends(require_staff())

# The authorization model, mirroring the enforced require_staff gates across the
# CRM routers. Roles: ops, verification, finance, support, marketing, admin
# (super-admin is implicitly allowed everywhere). Keep in sync with the routers.
_PERMISSIONS: list[tuple[str, tuple[str, ...], str]] = [
    ("Operations dashboard", ("ops",), "Live metrics and operational KPIs."),
    ("Live Operations", ("ops",), "Real-time queues, dispatch health, live map."),
    ("Customers", ("ops", "support"), "Directory, 360 profile, suspend; export super-admin only."),
    ("Partners", ("ops", "verification"), "Directory, 360 profile, earnings (read)."),
    ("KYC & Verification", ("verification",), "Documents, decisions, private file access."),
    ("Bookings & dispatch", ("ops",), "Booking detail, manual reassignment."),
    ("Finance", ("finance",), "Payments, ledger, refunds, payouts."),
    ("Reviews moderation", ("support",), "Hide/unhide reviews."),
    ("Support", ("support",), "Ticket queue, assignment, replies, resolution."),
    ("Audit log", ("admin",), "This viewer — super-admin only."),
    ("Staff & Roles", ("admin",), "Manage staff accounts and role assignment."),
]
_ROLE_ORDER = ("ops", "verification", "finance", "support", "marketing", "admin")


@router.get("", response_model=AuditLogList)
async def list_audit(
    _: CurrentAdmin = _admin,
    session: AsyncSession = Depends(get_session),
    action: str | None = Query(default=None),
    entity: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=160),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> AuditLogList:
    base: Select = select(AuditLog)
    if action:
        base = base.where(AuditLog.action == action)
    if entity:
        base = base.where(AuditLog.entity == entity)
    if actor:
        base = base.where(AuditLog.actor_email.ilike(f"%{actor.strip()}%"))
    if q:
        like = f"%{q.strip()}%"
        base = base.where(
            or_(
                AuditLog.action.ilike(like),
                AuditLog.actor_email.ilike(like),
                AuditLog.entity_id.ilike(like),
                AuditLog.entity.ilike(like),
            )
        )
    if date_from:
        base = base.where(AuditLog.created_at >= date_from)
    if date_to:
        base = base.where(AuditLog.created_at <= date_to)

    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    rows = (
        await session.execute(
            base.order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return AuditLogList(
        items=[
            AuditLogRow(
                id=str(r.id), action=r.action, actor_email=r.actor_email,
                entity=r.entity, entity_id=r.entity_id, ip=r.ip, meta=r.meta,
                created_at=r.created_at,
            )
            for r in rows
        ],
        total=total, page=page, page_size=page_size,
    )


@router.get("/meta", response_model=AuditMetaOut)
async def audit_meta(
    _: CurrentAdmin = _admin, session: AsyncSession = Depends(get_session)
) -> AuditMetaOut:
    actions = (
        await session.execute(select(AuditLog.action).distinct().order_by(AuditLog.action))
    ).scalars().all()
    entities = (
        await session.execute(
            select(AuditLog.entity).distinct().where(AuditLog.entity.is_not(None)).order_by(AuditLog.entity)
        )
    ).scalars().all()
    return AuditMetaOut(actions=list(actions), entities=list(entities))


@router.get("/permissions", response_model=PermissionMatrixOut)
async def permissions(_: CurrentAdmin = _admin) -> PermissionMatrixOut:
    return PermissionMatrixOut(
        roles=list(_ROLE_ORDER),
        modules=[
            PermissionRow(module=m, roles=list(roles), description=desc)
            for (m, roles, desc) in _PERMISSIONS
        ],
    )
