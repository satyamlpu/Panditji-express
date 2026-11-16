"""Customer app API: profile, addresses and bookings."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ContentStatus
from app.core.errors import APIError, NotFoundError
from app.core.ratelimit import rate_limit
from app.db.session import get_session
from app.marketplace import dispatch, finance, support
from app.marketplace.constants import BookingMode, BookingStatus, MpAudit, TicketStatus
from app.marketplace.eta import eta_minutes
from app.marketplace.geo import haversine_km
from app.marketplace.models import (
    Booking,
    BookingEvent,
    Customer,
    CustomerAddress,
    Notification,
    Pandit,
    Review,
    SupportTicket,
)
from app.marketplace.principals import CurrentCustomer, client_ip, get_current_customer
from app.marketplace.schemas import (
    AddressCreate,
    AddressOut,
    BookingCreate,
    BookingEventOut,
    BookingOut,
    CancelRequest,
    CustomerOut,
    CustomerUpdate,
    NotificationOut,
    OrderOut,
    ReviewCreate,
    TicketCreate,
    TicketDetailOut,
    TicketOut,
    TicketReply,
    TrackingOut,
)
from app.marketplace.serialize import booking_out
from app.models.service import Service
from app.services.audit import audit
from app.services.money import price_display

STALE_SECONDS = 45

router = APIRouter(prefix="/api/v1/mp/customer", tags=["mp:customer"])


async def _load_customer(session: AsyncSession, cid: str) -> Customer:
    return (
        await session.execute(select(Customer).where(Customer.id == uuid.UUID(cid)))
    ).scalar_one()


def _booking_code() -> str:
    return "PJ-" + secrets.token_hex(3).upper()


@router.get("/profile", response_model=CustomerOut)
async def get_profile(
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> CustomerOut:
    c = await _load_customer(session, me.id)
    return CustomerOut(id=str(c.id), phone=c.phone, name=c.name, language=c.language)


@router.patch("/profile", response_model=CustomerOut)
async def update_profile(
    payload: CustomerUpdate,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> CustomerOut:
    c = await _load_customer(session, me.id)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(c, k, v)
    await session.flush()
    return CustomerOut(id=str(c.id), phone=c.phone, name=c.name, language=c.language)


@router.get("/addresses", response_model=list[AddressOut])
async def list_addresses(
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> list[AddressOut]:
    rows = (
        (
            await session.execute(
                select(CustomerAddress).where(CustomerAddress.customer_id == uuid.UUID(me.id))
            )
        )
        .scalars()
        .all()
    )
    return [
        AddressOut(
            id=str(a.id),
            label=a.label,
            line=a.line,
            landmark=a.landmark,
            instructions=a.instructions,
            lat=a.lat,
            lng=a.lng,
        )
        for a in rows
    ]


@router.post("/addresses", response_model=AddressOut, status_code=201)
async def add_address(
    payload: AddressCreate,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> AddressOut:
    a = CustomerAddress(customer_id=uuid.UUID(me.id), **payload.model_dump())
    session.add(a)
    await session.flush()
    return AddressOut(
        id=str(a.id),
        label=a.label,
        line=a.line,
        landmark=a.landmark,
        instructions=a.instructions,
        lat=a.lat,
        lng=a.lng,
    )


@router.post("/bookings", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    request: Request,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> BookingOut:
    ip = client_ip(request)
    if not await rate_limit(f"mp_booking:{me.id}", 10, window_seconds=600):
        raise APIError("Too many booking requests.", code="rate_limited", status_code=429)

    service = (
        await session.execute(
            select(Service).where(
                Service.slug == payload.service_slug,
                Service.status == ContentStatus.PUBLISHED,
            )
        )
    ).scalar_one_or_none()
    if service is None:
        raise NotFoundError("Service not found")

    # Resolve destination: saved address or inline coordinates.
    if payload.address_id:
        addr = (
            await session.execute(
                select(CustomerAddress).where(
                    CustomerAddress.id == uuid.UUID(payload.address_id),
                    CustomerAddress.customer_id == uuid.UUID(me.id),
                )
            )
        ).scalar_one_or_none()
        if addr is None:
            raise NotFoundError("Address not found")
        line, landmark, lat, lng = addr.line, addr.landmark, addr.lat, addr.lng
    elif payload.lat is not None and payload.lng is not None and payload.address_line:
        line, landmark, lat, lng = (
            payload.address_line,
            payload.landmark,
            payload.lat,
            payload.lng,
        )
    else:
        raise APIError(
            "Provide a saved address_id or address_line with lat/lng.",
            code="validation_error",
            status_code=422,
        )

    if payload.mode == BookingMode.SCHEDULED and payload.scheduled_at is None:
        raise APIError(
            "scheduled_at is required for a scheduled booking.",
            code="validation_error",
            status_code=422,
        )

    booking = Booking(
        code=_booking_code(),
        customer_id=uuid.UUID(me.id),
        service_id=service.id,
        mode=payload.mode,
        scheduled_at=payload.scheduled_at,
        status=BookingStatus.REQUESTED,
        address_line=line,
        landmark=landmark,
        dest_lat=lat,
        dest_lng=lng,
        service_title_snapshot=service.title,
        price_paise=service.price_paise,
    )
    session.add(booking)
    await session.flush()
    await audit(
        session,
        action=MpAudit.BOOKING_CREATE,
        actor_id=me.id,
        entity="booking",
        entity_id=str(booking.id),
        ip=ip,
        meta={"service": service.slug, "mode": payload.mode},
    )

    # Immediate bookings dispatch now; scheduled ones wait for the scheduler.
    if payload.mode == BookingMode.IMMEDIATE:
        await dispatch.start_dispatch(session, booking)

    return await booking_out(session, booking)


async def _owned_booking(session: AsyncSession, me: CurrentCustomer, bid: str) -> Booking:
    try:
        b = (
            await session.execute(
                select(Booking).where(
                    Booking.id == uuid.UUID(bid),
                    Booking.customer_id == uuid.UUID(me.id),
                )
            )
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Booking not found") from None
    if b is None:
        raise NotFoundError("Booking not found")
    return b


@router.get("/bookings", response_model=list[BookingOut])
async def my_bookings(
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> list[BookingOut]:
    rows = (
        (
            await session.execute(
                select(Booking)
                .where(Booking.customer_id == uuid.UUID(me.id))
                .order_by(Booking.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await booking_out(session, b) for b in rows]


@router.get("/bookings/{bid}", response_model=BookingOut)
async def get_booking(
    bid: str,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> BookingOut:
    b = await _owned_booking(session, me, bid)
    await dispatch.tick(session, b)  # lazily expire/advance a stale offer
    return await booking_out(session, b)


@router.get("/bookings/{bid}/events", response_model=list[BookingEventOut])
async def booking_events(
    bid: str,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> list[BookingEventOut]:
    b = await _owned_booking(session, me, bid)
    rows = (
        (
            await session.execute(
                select(BookingEvent)
                .where(BookingEvent.booking_id == b.id)
                .order_by(BookingEvent.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return [
        BookingEventOut(
            from_status=e.from_status,
            to_status=e.to_status,
            actor=e.actor,
            reason=e.reason,
            at=e.created_at,
        )
        for e in rows
    ]


@router.get("/bookings/{bid}/tracking", response_model=TrackingOut)
async def tracking(
    bid: str,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> TrackingOut:
    """Live partner location + ETA for an assigned, active booking only."""
    b = await _owned_booking(session, me, bid)
    if b.status not in BookingStatus.ASSIGNED or b.assigned_pandit_id is None:
        raise APIError(
            "Tracking is available only for an active, assigned booking.",
            code="not_trackable",
            status_code=409,
        )
    p = (
        await session.execute(select(Pandit).where(Pandit.id == b.assigned_pandit_id))
    ).scalar_one()

    has_loc = p.live_lat is not None and p.live_at is not None
    freshness = None
    is_stale = True
    eta = None
    lat = lng = None
    updated = None
    if has_loc:
        live_at = p.live_at if p.live_at.tzinfo else p.live_at.replace(tzinfo=UTC)
        freshness = int((datetime.now(UTC) - live_at).total_seconds())
        is_stale = freshness > STALE_SECONDS
        lat, lng, updated = p.live_lat, p.live_lng, p.live_at
        eta = eta_minutes(haversine_km(p.live_lat, p.live_lng, b.dest_lat, b.dest_lng))

    return TrackingOut(
        booking_status=b.status,
        pandit_name=p.name,
        has_location=has_loc,
        lat=lat,
        lng=lng,
        updated_at=updated,
        freshness_seconds=freshness,
        is_stale=is_stale,
        eta_minutes=eta,
        dest_lat=b.dest_lat,
        dest_lng=b.dest_lng,
    )


@router.get("/notifications", response_model=list[NotificationOut])
async def notifications(
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationOut]:
    rows = (
        (
            await session.execute(
                select(Notification)
                .where(
                    Notification.recipient_kind == "customer",
                    Notification.recipient_id == uuid.UUID(me.id),
                )
                .order_by(Notification.created_at.desc())
                .limit(50)
            )
        )
        .scalars()
        .all()
    )
    return [
        NotificationOut(
            id=str(n.id),
            kind=n.kind,
            title=n.title,
            body=n.body,
            booking_id=str(n.booking_id) if n.booking_id else None,
            read=n.read,
            created_at=n.created_at,
        )
        for n in rows
    ]


@router.post("/notifications/read-all")
async def read_all_notifications(
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> dict:
    for n in (
        (
            await session.execute(
                select(Notification).where(
                    Notification.recipient_kind == "customer",
                    Notification.recipient_id == uuid.UUID(me.id),
                    Notification.read.is_(False),
                )
            )
        )
        .scalars()
        .all()
    ):
        n.read = True
    await session.flush()
    return {"ok": True}


_PAYABLE = (*BookingStatus.ASSIGNED, BookingStatus.COMPLETED)


@router.post("/bookings/{bid}/pay", response_model=OrderOut)
async def pay(
    bid: str,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    """Create a payment order. The order is only 'paid' once the gateway's
    signed webhook is verified — a client call never confirms payment."""
    b = await _owned_booking(session, me, bid)
    if b.status not in _PAYABLE:
        raise APIError(
            "This booking isn't ready for payment yet.",
            code="not_payable",
            status_code=409,
        )
    payment = await finance.create_order(session, b)
    return OrderOut(
        payment_id=str(payment.id),
        provider_order_id=payment.provider_order_id,
        amount_paise=payment.amount_paise,
        amount_display=price_display(payment.amount_paise),
        status=payment.status,
        note="Complete payment with the gateway; confirmation arrives via webhook.",
    )


@router.post("/bookings/{bid}/review", status_code=201)
async def submit_review(
    bid: str,
    payload: ReviewCreate,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> dict:
    b = await _owned_booking(session, me, bid)
    if b.status != BookingStatus.COMPLETED or b.assigned_pandit_id is None:
        raise APIError(
            "You can review only a completed booking.",
            code="not_reviewable",
            status_code=409,
        )
    exists = (
        (await session.execute(select(Review).where(Review.booking_id == b.id))).scalars().first()
    )
    if exists is not None:
        raise APIError("This booking is already reviewed.", code="conflict", status_code=409)

    session.add(
        Review(
            booking_id=b.id,
            customer_id=uuid.UUID(me.id),
            pandit_id=b.assigned_pandit_id,
            rating=payload.rating,
            comment=payload.comment,
        )
    )
    pandit = (
        await session.execute(select(Pandit).where(Pandit.id == b.assigned_pandit_id))
    ).scalar_one()
    pandit.rating_sum += payload.rating
    pandit.rating_count += 1
    await session.flush()
    await audit(
        session,
        action=MpAudit.REVIEW_CREATE,
        actor_id=me.id,
        entity="booking",
        entity_id=str(b.id),
        meta={"rating": payload.rating},
    )
    return {"ok": True, "rating": payload.rating}


@router.post("/support/tickets", response_model=TicketOut, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> TicketOut:
    ticket = await support.create_ticket(
        session,
        opener_kind="customer",
        opener_id=me.id,
        subject=payload.subject,
        body=payload.body,
        booking_id=payload.booking_id,
    )
    await audit(
        session,
        action=MpAudit.TICKET_CREATE,
        actor_id=me.id,
        entity="ticket",
        entity_id=str(ticket.id),
    )
    return TicketOut(**await support.ticket_dict(session, ticket))


async def _my_ticket(session: AsyncSession, me: CurrentCustomer, tid: str) -> SupportTicket:
    try:
        t = (
            await session.execute(
                select(SupportTicket).where(
                    SupportTicket.id == uuid.UUID(tid),
                    SupportTicket.opener_kind == "customer",
                    SupportTicket.opener_id == uuid.UUID(me.id),
                )
            )
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Ticket not found") from None
    if t is None:
        raise NotFoundError("Ticket not found")
    return t


@router.get("/support/tickets", response_model=list[TicketOut])
async def list_tickets(
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> list[TicketOut]:
    rows = (
        (
            await session.execute(
                select(SupportTicket)
                .where(
                    SupportTicket.opener_kind == "customer",
                    SupportTicket.opener_id == uuid.UUID(me.id),
                )
                .order_by(SupportTicket.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [TicketOut(**await support.ticket_dict(session, t)) for t in rows]


@router.get("/support/tickets/{tid}", response_model=TicketDetailOut)
async def get_ticket(
    tid: str,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> TicketDetailOut:
    t = await _my_ticket(session, me, tid)
    return TicketDetailOut(
        **await support.ticket_dict(session, t),
        resolution=t.resolution,
        messages=await support.messages(session, t),
    )


@router.post("/support/tickets/{tid}/reply", response_model=TicketDetailOut)
async def reply_ticket(
    tid: str,
    payload: TicketReply,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> TicketDetailOut:
    t = await _my_ticket(session, me, tid)
    if t.status in TicketStatus.CLOSED_STATES:
        raise APIError("This ticket is closed.", code="closed", status_code=409)
    await support.add_message(session, t, author="customer", body=payload.body)
    return TicketDetailOut(
        **await support.ticket_dict(session, t),
        resolution=t.resolution,
        messages=await support.messages(session, t),
    )


@router.post("/bookings/{bid}/cancel", response_model=BookingOut)
async def cancel_booking(
    bid: str,
    payload: CancelRequest,
    me: CurrentCustomer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session),
) -> BookingOut:
    b = await _owned_booking(session, me, bid)
    await dispatch.cancel_booking(
        session,
        b,
        to_status=BookingStatus.CANCELLED_CUSTOMER,
        actor="customer",
        reason=payload.reason,
    )
    return await booking_out(session, b)
