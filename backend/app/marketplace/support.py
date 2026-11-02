"""Support tickets (SRS SUP module): references, threaded messages, assignment,
escalation and resolution — with controlled, scoped access."""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.marketplace.models import (
    Booking,
    Customer,
    Pandit,
    SupportTicket,
    TicketMessage,
)


def ref_code() -> str:
    return "TKT-" + secrets.token_hex(3).upper()


async def create_ticket(
    session: AsyncSession,
    *,
    opener_kind: str,
    opener_id: str,
    subject: str,
    body: str,
    booking_id: str | None,
) -> SupportTicket:
    bid = None
    if booking_id:
        try:
            bid = uuid.UUID(booking_id)
        except ValueError:
            bid = None
    ticket = SupportTicket(
        ref=ref_code(),
        opener_kind=opener_kind,
        opener_id=uuid.UUID(opener_id),
        booking_id=bid,
        subject=subject,
    )
    session.add(ticket)
    await session.flush()
    session.add(TicketMessage(ticket_id=ticket.id, author=opener_kind, body=body))
    await session.flush()
    return ticket


async def add_message(
    session: AsyncSession, ticket: SupportTicket, *, author: str, body: str
) -> None:
    session.add(TicketMessage(ticket_id=ticket.id, author=author, body=body))
    await session.flush()


async def _opener_label(session: AsyncSession, ticket: SupportTicket) -> str | None:
    if ticket.opener_kind == "customer":
        c = (
            await session.execute(select(Customer).where(Customer.id == ticket.opener_id))
        ).scalar_one_or_none()
        return f"{c.name or 'Customer'} · {c.phone}" if c else None
    p = (
        await session.execute(select(Pandit).where(Pandit.id == ticket.opener_id))
    ).scalar_one_or_none()
    return f"{p.name or 'Pandit'} · {p.phone}" if p else None


async def ticket_dict(
    session: AsyncSession, ticket: SupportTicket, *, with_opener: bool = False
) -> dict:
    booking_code = None
    if ticket.booking_id:
        b = (
            await session.execute(select(Booking).where(Booking.id == ticket.booking_id))
        ).scalar_one_or_none()
        booking_code = b.code if b else None
    data = {
        "id": str(ticket.id),
        "ref": ticket.ref,
        "subject": ticket.subject,
        "status": ticket.status,
        "assignee_email": ticket.assignee_email,
        "booking_code": booking_code,
        "opener_kind": ticket.opener_kind,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
    }
    if with_opener:
        data["opener_label"] = await _opener_label(session, ticket)
    return data


async def messages(session: AsyncSession, ticket: SupportTicket) -> list[dict]:
    rows = (
        (
            await session.execute(
                select(TicketMessage)
                .where(TicketMessage.ticket_id == ticket.id)
                .order_by(TicketMessage.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return [{"author": m.author, "body": m.body, "at": m.created_at} for m in rows]
