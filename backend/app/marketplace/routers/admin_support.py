"""Admin support: ticket queue, assignment, replies and resolution (SUP module).

Gated to the support role (+ super-admin); every change is audited and the
opener is notified. Replies and status changes record the acting staff member.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.errors import APIError, NotFoundError
from app.db.session import get_session
from app.marketplace import support
from app.marketplace.constants import MpAudit, Principal, StaffRole, TicketStatus
from app.marketplace.models import SupportTicket
from app.marketplace.notify import notify_customer, notify_pandit
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    TicketAssign,
    TicketDetailOut,
    TicketOut,
    TicketReply,
    TicketStatusUpdate,
)
from app.services.audit import audit

router = APIRouter(prefix="/api/v1/mp/admin/support", tags=["mp:admin-support"])

_support = Depends(require_staff(StaffRole.SUPPORT))


async def _load(session: AsyncSession, tid: str) -> SupportTicket:
    try:
        t = (
            await session.execute(select(SupportTicket).where(SupportTicket.id == uuid.UUID(tid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Ticket not found") from None
    if t is None:
        raise NotFoundError("Ticket not found")
    return t


async def _notify_opener(session: AsyncSession, t: SupportTicket, *, title: str, body: str) -> None:
    if t.opener_kind == Principal.CUSTOMER:
        await notify_customer(session, t.opener_id, kind="support", title=title, body=body)
    else:
        await notify_pandit(session, t.opener_id, kind="support", title=title, body=body)


async def _detail(session: AsyncSession, t: SupportTicket) -> TicketDetailOut:
    return TicketDetailOut(
        **await support.ticket_dict(session, t, with_opener=True),
        resolution=t.resolution,
        messages=await support.messages(session, t),
    )


@router.get("/tickets", response_model=list[TicketOut])
async def list_tickets(
    _: CurrentAdmin = _support,
    session: AsyncSession = Depends(get_session),
    status: str | None = Query(default=None),
) -> list[TicketOut]:
    stmt = select(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(200)
    if status:
        stmt = stmt.where(SupportTicket.status == status)
    rows = (await session.execute(stmt)).scalars().all()
    return [TicketOut(**await support.ticket_dict(session, t, with_opener=True)) for t in rows]


@router.get("/tickets/{tid}", response_model=TicketDetailOut)
async def get_ticket(
    tid: str, _: CurrentAdmin = _support, session: AsyncSession = Depends(get_session)
) -> TicketDetailOut:
    return await _detail(session, await _load(session, tid))


@router.post("/tickets/{tid}/assign", response_model=TicketDetailOut)
async def assign(
    tid: str,
    payload: TicketAssign,
    admin: CurrentAdmin = _support,
    session: AsyncSession = Depends(get_session),
) -> TicketDetailOut:
    t = await _load(session, tid)
    t.assignee_email = payload.assignee_email or admin.email
    if t.status == TicketStatus.OPEN:
        t.status = TicketStatus.ASSIGNED
    await session.flush()
    await audit(
        session,
        action=MpAudit.TICKET_UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="ticket",
        entity_id=str(t.id),
        meta={"assigned_to": t.assignee_email},
    )
    return await _detail(session, t)


@router.post("/tickets/{tid}/reply", response_model=TicketDetailOut)
async def reply(
    tid: str,
    payload: TicketReply,
    admin: CurrentAdmin = _support,
    session: AsyncSession = Depends(get_session),
) -> TicketDetailOut:
    t = await _load(session, tid)
    await support.add_message(session, t, author=f"admin:{admin.email}", body=payload.body)
    await _notify_opener(session, t, title="Support replied", body=f"Re: {t.subject}")
    await audit(
        session,
        action=MpAudit.TICKET_UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="ticket",
        entity_id=str(t.id),
        meta={"action": "reply"},
    )
    return await _detail(session, t)


@router.post("/tickets/{tid}/status", response_model=TicketDetailOut)
async def set_status(
    tid: str,
    payload: TicketStatusUpdate,
    admin: CurrentAdmin = _support,
    session: AsyncSession = Depends(get_session),
) -> TicketDetailOut:
    t = await _load(session, tid)
    if payload.status in TicketStatus.CLOSED_STATES and not (payload.resolution or t.resolution):
        raise APIError(
            "A resolution note is required to resolve or close a ticket.",
            code="resolution_required",
            status_code=422,
        )
    t.status = payload.status
    if payload.resolution:
        t.resolution = payload.resolution
    await session.flush()
    await _notify_opener(session, t, title=f"Ticket {payload.status}", body=t.subject)
    await audit(
        session,
        action=MpAudit.TICKET_UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="ticket",
        entity_id=str(t.id),
        meta={"status": payload.status},
    )
    return await _detail(session, t)
