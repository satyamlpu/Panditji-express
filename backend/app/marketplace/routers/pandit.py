"""Pandit Partner app API: onboarding, availability, offers and active bookings."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ContentStatus
from app.core.errors import APIError, NotFoundError
from app.db.session import get_session
from app.marketplace import dispatch, support
from app.marketplace.constants import (
    Availability,
    BookingStatus,
    DispatchOutcome,
    MpAudit,
    PanditStatus,
    TicketStatus,
)
from app.marketplace.eta import eta_minutes
from app.marketplace.geo import haversine_km
from app.marketplace.models import (
    Booking,
    DispatchAttempt,
    Notification,
    Pandit,
    PanditCapability,
    SupportTicket,
    VerificationDocument,
)
from app.marketplace.principals import CurrentPandit, client_ip, get_current_pandit
from app.marketplace.schemas import (
    AvailabilityUpdate,
    BookingOut,
    LocationPing,
    NotificationOut,
    OfferOut,
    PanditOnboard,
    PanditOut,
    TicketCreate,
    TicketDetailOut,
    TicketOut,
    TicketReply,
    VerificationDocumentOut,
    VerificationStatusOut,
)
from app.marketplace.serialize import booking_out, pandit_out
from app.marketplace.storage import (
    ALLOWED_CONTENT_TYPES,
    StorageError,
    build_key,
    get_storage,
)
from app.models.service import Service
from app.services.audit import audit
from app.services.money import price_display

router = APIRouter(prefix="/api/v1/mp/partner", tags=["mp:partner"])


async def _load(session: AsyncSession, pid: str) -> Pandit:
    return (await session.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))).scalar_one()


def _touch_heartbeat(p: Pandit) -> None:
    p.last_heartbeat = datetime.now(UTC)


@router.get("/profile", response_model=PanditOut)
async def get_profile(
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> PanditOut:
    return await pandit_out(session, await _load(session, me.id))


@router.post("/onboard", response_model=PanditOut)
async def onboard(
    payload: PanditOnboard,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> PanditOut:
    """Submit profile + capabilities for verification (Draft → Submitted)."""
    p = await _load(session, me.id)
    if p.status in (PanditStatus.APPROVED, PanditStatus.SUSPENDED, PanditStatus.REJECTED):
        raise APIError(
            "Profile cannot be re-submitted in its current state.",
            code="invalid_state",
            status_code=409,
        )

    p.name = payload.name
    p.languages = payload.languages
    p.city = payload.city
    p.base_lat = payload.base_lat
    p.base_lng = payload.base_lng
    p.service_radius_km = payload.service_radius_km
    p.status = PanditStatus.SUBMITTED

    # Reset + set capabilities from published services.
    for cap in (
        (await session.execute(select(PanditCapability).where(PanditCapability.pandit_id == p.id)))
        .scalars()
        .all()
    ):
        await session.delete(cap)
    await session.flush()

    services = (
        (
            await session.execute(
                select(Service).where(
                    Service.slug.in_(payload.service_slugs),
                    Service.status == ContentStatus.PUBLISHED,
                )
            )
        )
        .scalars()
        .all()
    )
    for s in services:
        session.add(PanditCapability(pandit_id=p.id, service_id=s.id))
    await session.flush()
    return await pandit_out(session, p)


@router.patch("/availability", response_model=PanditOut)
async def set_availability(
    payload: AvailabilityUpdate,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> PanditOut:
    p = await _load(session, me.id)
    if payload.availability == Availability.ONLINE and p.status != PanditStatus.APPROVED:
        raise APIError(
            "You can go online only after your account is approved.",
            code="not_approved",
            status_code=409,
        )
    if p.availability == Availability.BUSY:
        raise APIError(
            "Finish your active booking before changing availability.",
            code="busy",
            status_code=409,
        )
    p.availability = payload.availability
    _touch_heartbeat(p)
    await session.flush()
    return await pandit_out(session, p)


@router.post("/heartbeat", response_model=PanditOut)
async def heartbeat(
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> PanditOut:
    """Keep availability 'fresh' so an abandoned app isn't treated as live."""
    p = await _load(session, me.id)
    _touch_heartbeat(p)
    await session.flush()
    return await pandit_out(session, p)


@router.get("/booking-requests", response_model=list[OfferOut])
async def booking_requests(
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> list[OfferOut]:
    p = await _load(session, me.id)
    _touch_heartbeat(p)
    offers = (
        (
            await session.execute(
                select(DispatchAttempt)
                .where(
                    DispatchAttempt.pandit_id == p.id,
                    DispatchAttempt.outcome == DispatchOutcome.OFFERED,
                )
                .order_by(DispatchAttempt.offered_at.desc())
            )
        )
        .scalars()
        .all()
    )

    out: list[OfferOut] = []
    now = datetime.now(UTC)
    for o in offers:
        b = (
            await session.execute(select(Booking).where(Booking.id == o.booking_id))
        ).scalar_one_or_none()
        if b is None or b.status != BookingStatus.AWAITING_ACCEPTANCE:
            continue
        exp = o.expires_at if o.expires_at.tzinfo else o.expires_at.replace(tzinfo=UTC)
        if exp <= now:
            continue
        out.append(
            OfferOut(
                booking_id=str(b.id),
                code=b.code,
                service_title=b.service_title_snapshot,
                address_line=b.address_line,
                landmark=b.landmark,
                dest_lat=b.dest_lat,
                dest_lng=b.dest_lng,
                distance_km=o.distance_km,
                price_display=price_display(b.price_paise),
                offered_at=o.offered_at,
                expires_at=o.expires_at,
            )
        )
    await session.flush()
    return out


@router.post("/booking-requests/{booking_id}/accept", response_model=BookingOut)
async def accept(
    booking_id: str,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> BookingOut:
    p = await _load(session, me.id)
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        raise NotFoundError("Booking not found") from None
    b = await dispatch.accept_offer(session, p, bid)
    return await booking_out(session, b)


@router.post("/booking-requests/{booking_id}/reject", status_code=200)
async def reject(
    booking_id: str,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> dict:
    p = await _load(session, me.id)
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        raise NotFoundError("Booking not found") from None
    await dispatch.reject_offer(session, p, bid)
    return {"ok": True}


@router.get("/bookings", response_model=list[BookingOut])
async def my_bookings(
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> list[BookingOut]:
    rows = (
        (
            await session.execute(
                select(Booking)
                .where(Booking.assigned_pandit_id == uuid.UUID(me.id))
                .order_by(Booking.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await booking_out(session, b) for b in rows]


@router.post("/bookings/{booking_id}/status", response_model=BookingOut)
async def advance(
    booking_id: str,
    body: dict,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> BookingOut:
    to_status = body.get("to_status")
    if to_status not in (
        BookingStatus.EN_ROUTE,
        BookingStatus.ARRIVED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.COMPLETED,
    ):
        raise APIError("Invalid target status", code="validation_error", status_code=422)
    try:
        b = (
            await session.execute(
                select(Booking).where(
                    Booking.id == uuid.UUID(booking_id),
                    Booking.assigned_pandit_id == uuid.UUID(me.id),
                )
            )
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Booking not found") from None
    if b is None:
        raise NotFoundError("Booking not found")
    await dispatch.advance_status(session, b, to_status, actor="pandit")
    return await booking_out(session, b)


@router.post("/location")
async def post_location(
    payload: LocationPing,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Share live location — only while on an active booking (purpose-limited)."""
    p = await _load(session, me.id)
    active = (
        (
            await session.execute(
                select(Booking)
                .where(
                    Booking.assigned_pandit_id == p.id,
                    Booking.status.in_(BookingStatus.ASSIGNED),
                )
                .order_by(Booking.confirmed_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if active is None:
        raise APIError(
            "Location sharing is only available during an active booking.",
            code="no_active_booking",
            status_code=409,
        )
    p.live_lat = payload.lat
    p.live_lng = payload.lng
    p.live_accuracy_m = payload.accuracy_m
    p.live_at = datetime.now(UTC)
    _touch_heartbeat(p)
    await session.flush()
    dist = haversine_km(payload.lat, payload.lng, active.dest_lat, active.dest_lng)
    return {"ok": True, "booking_code": active.code, "eta_minutes": eta_minutes(dist)}


@router.get("/notifications", response_model=list[NotificationOut])
async def notifications(
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationOut]:
    rows = (
        (
            await session.execute(
                select(Notification)
                .where(
                    Notification.recipient_kind == "pandit",
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
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> dict:
    for n in (
        (
            await session.execute(
                select(Notification).where(
                    Notification.recipient_kind == "pandit",
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


# ── Support tickets ──────────────────────────────────────────────────────────
@router.post("/support/tickets", response_model=TicketOut, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> TicketOut:
    ticket = await support.create_ticket(
        session,
        opener_kind="pandit",
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


async def _my_ticket(session: AsyncSession, me: CurrentPandit, tid: str) -> SupportTicket:
    try:
        t = (
            await session.execute(
                select(SupportTicket).where(
                    SupportTicket.id == uuid.UUID(tid),
                    SupportTicket.opener_kind == "pandit",
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
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> list[TicketOut]:
    rows = (
        (
            await session.execute(
                select(SupportTicket)
                .where(
                    SupportTicket.opener_kind == "pandit",
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
    me: CurrentPandit = Depends(get_current_pandit),
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
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> TicketDetailOut:
    t = await _my_ticket(session, me, tid)
    if t.status in TicketStatus.CLOSED_STATES:
        raise APIError("This ticket is closed.", code="closed", status_code=409)
    await support.add_message(session, t, author="pandit", body=payload.body)
    return TicketDetailOut(
        **await support.ticket_dict(session, t),
        resolution=t.resolution,
        messages=await support.messages(session, t),
    )


def _doc_out(d: VerificationDocument) -> VerificationDocumentOut:
    return VerificationDocumentOut(
        id=str(d.id),
        doc_type=d.doc_type,
        reference=d.note,
        has_file=d.file_ref is not None,
        content_type=d.content_type,
        status=d.status,
        decision_reason=d.decision_reason,
        created_at=d.created_at,
    )


@router.post(
    "/verification/documents", response_model=VerificationDocumentOut, status_code=201
)
async def submit_verification_document(
    request: Request,
    doc_type: str = Form(..., min_length=2, max_length=40),
    note: str | None = Form(default=None, max_length=200),
    file: UploadFile | None = File(default=None),
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> VerificationDocumentOut:
    """Partner submits a KYC document, optionally with a file (photo/scan).

    The file, if present, is validated against a MIME allowlist and a size cap,
    then stored under a server-generated key in **private** storage — never a
    public URL, and the client's filename is never used to build the path.
    Submitting moves a draft/returned partner into review.
    """
    p = await _load(session, me.id)
    if p.status in (PanditStatus.APPROVED, PanditStatus.SUSPENDED):
        raise APIError(
            "Your verification is already complete.", code="not_allowed", status_code=409
        )

    doc_id = uuid.uuid4()
    file_ref: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None

    if file is not None and file.filename:
        content_type = (file.content_type or "").split(";")[0].strip().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise APIError(
                "Unsupported file type. Upload a JPEG, PNG, WebP or PDF.",
                code="unsupported_media_type",
                status_code=415,
            )
        cap = settings.verification_max_upload_bytes
        # Read at most cap+1 bytes so an oversized upload can't exhaust memory.
        data = await file.read(cap + 1)
        if len(data) > cap:
            raise APIError(
                f"File too large. Maximum size is {cap // (1024 * 1024)} MB.",
                code="payload_too_large",
                status_code=413,
            )
        if not data:
            raise APIError("Uploaded file is empty.", code="bad_request", status_code=400)
        ext = ALLOWED_CONTENT_TYPES[content_type]
        key = build_key(me.id, str(doc_id), ext)
        try:
            file_ref = await get_storage().save(key, data, content_type)
        except StorageError:
            raise APIError(
                "Could not store the uploaded file. Please try again.",
                code="storage_error",
                status_code=502,
            ) from None
        size_bytes = len(data)

    doc = VerificationDocument(
        id=doc_id,
        pandit_id=uuid.UUID(me.id),
        doc_type=doc_type.strip(),
        note=(note.strip() or None) if note else None,
        file_ref=file_ref,
        content_type=content_type,
        size_bytes=size_bytes,
        status="pending",
    )
    session.add(doc)
    if p.status in (
        PanditStatus.DRAFT,
        PanditStatus.SUBMITTED,
        PanditStatus.ACTION_REQUIRED,
        PanditStatus.REJECTED,
    ):
        p.status = PanditStatus.UNDER_REVIEW
    await session.flush()
    await audit(
        session,
        action=MpAudit.VERIFICATION_DOC_SUBMIT,
        actor_id=me.id,
        entity="verification_document",
        entity_id=str(doc_id),
        ip=client_ip(request),
        meta={"doc_type": doc.doc_type, "has_file": file_ref is not None},
    )
    return _doc_out(doc)


@router.get("/verification", response_model=VerificationStatusOut)
async def my_verification(
    me: CurrentPandit = Depends(get_current_pandit),
    session: AsyncSession = Depends(get_session),
) -> VerificationStatusOut:
    p = await _load(session, me.id)
    docs = (
        (
            await session.execute(
                select(VerificationDocument)
                .where(VerificationDocument.pandit_id == uuid.UUID(me.id))
                .order_by(VerificationDocument.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return VerificationStatusOut(status=p.status, documents=[_doc_out(d) for d in docs])
