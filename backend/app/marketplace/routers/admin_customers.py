"""Admin Customers CRM (CUS module).

A full customer management surface for ops/support staff: a searchable,
sortable, paginated directory with live aggregates (bookings, spend, reviews,
open tickets), a 360° profile, and sub-resource tabs (bookings, payments +
refunds, reviews, tickets, addresses, account activity). Name/language edits,
suspend/reactivate and a permission-gated data export are all audited.

Read access: ops / support (+ super-admin). Account mutations: same.
Data export: super-admin only (sensitive bulk PII), always audited.

No customer is *created* here — customers self-register via phone + OTP — and
no hard delete is offered (destructive/irreversible + PII retention): suspension
is the reversible lifecycle control, and it takes effect immediately because the
auth principal re-reads status from the DB on every request.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.errors import NotFoundError
from app.db.session import get_session
from app.marketplace import support
from app.marketplace.constants import (
    AccountStatus,
    BookingStatus,
    MpAudit,
    Principal,
    StaffRole,
    TicketStatus,
)
from app.marketplace.models import (
    Booking,
    Customer,
    CustomerAddress,
    Payment,
    Review,
    SupportTicket,
)
from app.marketplace.principals import client_ip, require_staff
from app.marketplace.schemas import (
    AddressOut,
    BookingOut,
    CustomerActivityOut,
    CustomerAdminDetail,
    CustomerAdminOut,
    CustomerExportOut,
    CustomerListOut,
    CustomerStatusUpdate,
    CustomerUpdate,
    PaymentOut,
    ReviewOut,
    TicketOut,
)
from app.marketplace.serialize import booking_out
from app.models.audit import AuditLog
from app.services.audit import audit
from app.services.money import price_display

router = APIRouter(prefix="/api/v1/mp/admin/customers", tags=["mp:admin-customers"])

# Customers are an ops + support concern (super-admin always allowed).
_view = Depends(require_staff(StaffRole.OPS, StaffRole.SUPPORT))
_export = Depends(require_staff())  # super-admin only (bulk PII export)

_CANCELLED = (
    BookingStatus.CANCELLED_CUSTOMER,
    BookingStatus.CANCELLED_PARTNER,
    BookingStatus.CANCELLED_PLATFORM,
)
_SORTS = {
    "created_at": Customer.created_at,
    "name": Customer.name,
    "phone": Customer.phone,
}


# ── Aggregate helpers (batched over a page of customer ids; no N+1) ───────────
async def _booking_aggs(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, dict]:
    if not ids:
        return {}
    completed = func.sum(case((Booking.status == BookingStatus.COMPLETED, 1), else_=0))
    cancelled = func.sum(case((Booking.status.in_(_CANCELLED), 1), else_=0))
    rows = (
        await session.execute(
            select(
                Booking.customer_id,
                func.count(),
                completed,
                cancelled,
                func.max(Booking.created_at),
            )
            .where(Booking.customer_id.in_(ids))
            .group_by(Booking.customer_id)
        )
    ).all()
    return {
        str(cid): {
            "bookings": n or 0,
            "completed": int(done or 0),
            "cancelled": int(canc or 0),
            "last": last,
        }
        for cid, n, done, canc, last in rows
    }


async def _spend_aggs(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, int]:
    """Net amount actually paid (gross − refunded) per customer."""
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(
                Booking.customer_id,
                func.coalesce(func.sum(Payment.amount_paise - Payment.refunded_paise), 0),
            )
            .join(Booking, Booking.id == Payment.booking_id)
            .where(
                Booking.customer_id.in_(ids),
                Payment.status.in_(("paid", "partially_refunded")),
            )
            .group_by(Booking.customer_id)
        )
    ).all()
    return {str(cid): int(amt or 0) for cid, amt in rows}


async def _review_counts(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, int]:
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(Review.customer_id, func.count())
            .where(Review.customer_id.in_(ids))
            .group_by(Review.customer_id)
        )
    ).all()
    return {str(cid): n for cid, n in rows}


async def _open_ticket_counts(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, int]:
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(SupportTicket.opener_id, func.count())
            .where(
                SupportTicket.opener_kind == Principal.CUSTOMER,
                SupportTicket.opener_id.in_(ids),
                SupportTicket.status.notin_(TicketStatus.CLOSED_STATES),
            )
            .group_by(SupportTicket.opener_id)
        )
    ).all()
    return {str(oid): n for oid, n in rows}


def _row_out(c: Customer, b: dict, spend: int, reviews: int, tickets: int) -> CustomerAdminOut:
    return CustomerAdminOut(
        id=str(c.id),
        phone=c.phone,
        name=c.name,
        language=c.language,
        status=c.status,
        created_at=c.created_at,
        bookings_count=b.get("bookings", 0),
        completed_count=b.get("completed", 0),
        cancelled_count=b.get("cancelled", 0),
        total_spent_paise=spend,
        total_spent_display=price_display(spend) if spend else "₹0",
        review_count=reviews,
        open_tickets=tickets,
        last_booking_at=b.get("last"),
    )


async def _load(session: AsyncSession, cid: str) -> Customer:
    try:
        c = (
            await session.execute(select(Customer).where(Customer.id == uuid.UUID(cid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Customer not found") from None
    if c is None:
        raise NotFoundError("Customer not found")
    return c


# ── Directory ─────────────────────────────────────────────────────────────────
@router.get("", response_model=CustomerListOut)
async def list_customers(
    _: CurrentAdmin = _view,
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(default=None, max_length=120),
    status: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> CustomerListOut:
    base: Select = select(Customer)
    if q:
        like = f"%{q.strip()}%"
        base = base.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like)))
    if status in (AccountStatus.ACTIVE, AccountStatus.SUSPENDED):
        base = base.where(Customer.status == status)

    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    col = _SORTS.get(sort, Customer.created_at)
    base = base.order_by(col.asc() if order == "asc" else col.desc())
    base = base.offset((page - 1) * page_size).limit(page_size)
    customers = (await session.execute(base)).scalars().all()

    ids = [c.id for c in customers]
    baggs = await _booking_aggs(session, ids)
    spend = await _spend_aggs(session, ids)
    reviews = await _review_counts(session, ids)
    tickets = await _open_ticket_counts(session, ids)

    items = [
        _row_out(
            c,
            baggs.get(str(c.id), {}),
            spend.get(str(c.id), 0),
            reviews.get(str(c.id), 0),
            tickets.get(str(c.id), 0),
        )
        for c in customers
    ]
    return CustomerListOut(items=items, total=total, page=page, page_size=page_size)


async def _detail(session: AsyncSession, c: Customer) -> CustomerAdminDetail:
    ids = [c.id]
    b = (await _booking_aggs(session, ids)).get(str(c.id), {})
    spend = (await _spend_aggs(session, ids)).get(str(c.id), 0)
    reviews = (await _review_counts(session, ids)).get(str(c.id), 0)
    tickets = (await _open_ticket_counts(session, ids)).get(str(c.id), 0)
    row = _row_out(c, b, spend, reviews, tickets)
    addrs = (
        await session.execute(
            select(CustomerAddress)
            .where(CustomerAddress.customer_id == c.id)
            .order_by(CustomerAddress.created_at.asc())
        )
    ).scalars().all()
    return CustomerAdminDetail(
        **row.model_dump(),
        addresses=[
            AddressOut(
                id=str(a.id), label=a.label, line=a.line, landmark=a.landmark,
                instructions=a.instructions, lat=a.lat, lng=a.lng,
            )
            for a in addrs
        ],
    )


@router.get("/{cid}", response_model=CustomerAdminDetail)
async def get_customer(
    cid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> CustomerAdminDetail:
    return await _detail(session, await _load(session, cid))


# ── Sub-resource tabs ─────────────────────────────────────────────────────────
@router.get("/{cid}/bookings", response_model=list[BookingOut])
async def customer_bookings(
    cid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[BookingOut]:
    c = await _load(session, cid)
    rows = (
        await session.execute(
            select(Booking).where(Booking.customer_id == c.id).order_by(
                Booking.created_at.desc()
            )
        )
    ).scalars().all()
    return [await booking_out(session, b) for b in rows]


@router.get("/{cid}/payments", response_model=list[PaymentOut])
async def customer_payments(
    cid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[PaymentOut]:
    c = await _load(session, cid)
    rows = (
        await session.execute(
            select(Payment, Booking.code)
            .join(Booking, Booking.id == Payment.booking_id)
            .where(Booking.customer_id == c.id)
            .order_by(Payment.created_at.desc())
        )
    ).all()
    return [
        PaymentOut(
            id=str(p.id), booking_code=code, amount_paise=p.amount_paise,
            amount_display=price_display(p.amount_paise), status=p.status,
            provider_order_id=p.provider_order_id, provider_payment_id=p.provider_payment_id,
            refunded_paise=p.refunded_paise, paid_at=p.paid_at, created_at=p.created_at,
        )
        for p, code in rows
    ]


@router.get("/{cid}/reviews", response_model=list[ReviewOut])
async def customer_reviews(
    cid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[ReviewOut]:
    c = await _load(session, cid)
    rows = (
        await session.execute(
            select(Review, Booking.code)
            .join(Booking, Booking.id == Review.booking_id)
            .where(Review.customer_id == c.id)
            .order_by(Review.created_at.desc())
        )
    ).all()
    return [
        ReviewOut(
            id=str(r.id), booking_code=code, rating=r.rating, comment=r.comment,
            customer_name=c.name, pandit_name=None, reported=r.reported,
            hidden=r.hidden, created_at=r.created_at,
        )
        for r, code in rows
    ]


@router.get("/{cid}/tickets", response_model=list[TicketOut])
async def customer_tickets(
    cid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[TicketOut]:
    c = await _load(session, cid)
    rows = (
        await session.execute(
            select(SupportTicket)
            .where(
                SupportTicket.opener_kind == Principal.CUSTOMER,
                SupportTicket.opener_id == c.id,
            )
            .order_by(SupportTicket.created_at.desc())
        )
    ).scalars().all()
    return [TicketOut(**await support.ticket_dict(session, t, with_opener=True)) for t in rows]


@router.get("/{cid}/activity", response_model=list[CustomerActivityOut])
async def customer_activity(
    cid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[CustomerActivityOut]:
    """Account-level audit trail (admin actions on this customer account)."""
    c = await _load(session, cid)
    rows = (
        await session.execute(
            select(AuditLog)
            .where(AuditLog.entity == "customer", AuditLog.entity_id == str(c.id))
            .order_by(AuditLog.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    return [
        CustomerActivityOut(
            action=a.action, actor_email=a.actor_email, at=a.created_at, meta=a.meta
        )
        for a in rows
    ]


# ── Mutations (all audited) ────────────────────────────────────────────────────
@router.patch("/{cid}", response_model=CustomerAdminDetail)
async def update_customer(
    cid: str,
    payload: CustomerUpdate,
    request: Request,
    admin: CurrentAdmin = _view,
    session: AsyncSession = Depends(get_session),
) -> CustomerAdminDetail:
    c = await _load(session, cid)
    changes: dict = {}
    if payload.name is not None and payload.name != c.name:
        changes["name"] = {"from": c.name, "to": payload.name}
        c.name = payload.name
    if payload.language is not None and payload.language != c.language:
        changes["language"] = {"from": c.language, "to": payload.language}
        c.language = payload.language
    await session.flush()
    if changes:
        await audit(
            session, action=MpAudit.CUSTOMER_UPDATE, actor_id=admin.id,
            actor_email=admin.email, entity="customer", entity_id=str(c.id),
            ip=client_ip(request), meta=changes,
        )
    return await _detail(session, c)


@router.post("/{cid}/suspend", response_model=CustomerAdminDetail)
async def suspend_customer(
    cid: str,
    payload: CustomerStatusUpdate,
    request: Request,
    admin: CurrentAdmin = _view,
    session: AsyncSession = Depends(get_session),
) -> CustomerAdminDetail:
    c = await _load(session, cid)
    c.status = AccountStatus.SUSPENDED
    await session.flush()
    await audit(
        session, action=MpAudit.CUSTOMER_SUSPEND, actor_id=admin.id,
        actor_email=admin.email, entity="customer", entity_id=str(c.id),
        ip=client_ip(request), meta={"reason": payload.reason},
    )
    return await _detail(session, c)


@router.post("/{cid}/reactivate", response_model=CustomerAdminDetail)
async def reactivate_customer(
    cid: str,
    payload: CustomerStatusUpdate,
    request: Request,
    admin: CurrentAdmin = _view,
    session: AsyncSession = Depends(get_session),
) -> CustomerAdminDetail:
    c = await _load(session, cid)
    c.status = AccountStatus.ACTIVE
    await session.flush()
    await audit(
        session, action=MpAudit.CUSTOMER_REACTIVATE, actor_id=admin.id,
        actor_email=admin.email, entity="customer", entity_id=str(c.id),
        ip=client_ip(request), meta={"reason": payload.reason},
    )
    return await _detail(session, c)


@router.get("/{cid}/export", response_model=CustomerExportOut)
async def export_customer(
    cid: str,
    request: Request,
    admin: CurrentAdmin = _export,
    session: AsyncSession = Depends(get_session),
) -> CustomerExportOut:
    """Full account data export (super-admin only; audited PII access)."""
    c = await _load(session, cid)
    profile = await _detail(session, c)
    bookings = await customer_bookings(cid, admin, session)
    payments = await customer_payments(cid, admin, session)
    reviews = await customer_reviews(cid, admin, session)
    tickets = await customer_tickets(cid, admin, session)
    await audit(
        session, action=MpAudit.CUSTOMER_EXPORT, actor_id=admin.id,
        actor_email=admin.email, entity="customer", entity_id=str(c.id),
        ip=client_ip(request),
    )
    return CustomerExportOut(
        profile=profile, bookings=bookings, payments=payments, reviews=reviews,
        tickets=tickets, exported_at=datetime.now(UTC), exported_by=admin.email,
    )
