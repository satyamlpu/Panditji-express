"""Admin operations API: verification, booking operations and dashboard.

Staff roles gate access (ops / verification / super-admin); every high-impact
action records actor, reason and result via the audit log.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.errors import NotFoundError
from app.db.base import utcnow
from app.db.session import get_session
from app.marketplace import dispatch
from app.marketplace.constants import (
    Availability,
    BookingStatus,
    MpAudit,
    PanditStatus,
    StaffRole,
)
from app.marketplace.eta import eta_minutes
from app.marketplace.geo import haversine_km
from app.marketplace.models import (
    Booking,
    BookingEvent,
    Customer,
    DispatchAttempt,
    Pandit,
    PanditCapability,
)
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    BookingAdminDetail,
    BookingAdminOut,
    BookingEventOut,
    DashboardOut,
    DispatchAttemptOut,
    PanditAdminOut,
    PanditBrief,
    PanditOut,
    ReassignRequest,
    VerificationDecision,
)
from app.marketplace.serialize import pandit_out
from app.services.audit import audit
from app.services.money import price_display

router = APIRouter(prefix="/api/v1/mp/admin", tags=["mp:admin"])

_ops = Depends(require_staff(StaffRole.OPS))
_verify = Depends(require_staff(StaffRole.VERIFICATION))

_DECISION_STATUS = {
    "approve": PanditStatus.APPROVED,
    "reject": PanditStatus.REJECTED,
    "request_changes": PanditStatus.ACTION_REQUIRED,
    "suspend": PanditStatus.SUSPENDED,
}


async def _cap_count(session: AsyncSession, pandit_id) -> int:
    return (
        await session.execute(
            select(func.count()).select_from(PanditCapability).where(
                PanditCapability.pandit_id == pandit_id
            )
        )
    ).scalar_one()


async def _pandit_brief(session: AsyncSession, pid) -> PanditBrief | None:
    if pid is None:
        return None
    p = (await session.execute(select(Pandit).where(Pandit.id == pid))).scalar_one_or_none()
    return PanditBrief(id=str(p.id), name=p.name, languages=p.languages) if p else None


# ── Verification ─────────────────────────────────────────────────────────────
@router.get("/pandits", response_model=list[PanditAdminOut])
async def list_pandits(
    _: CurrentAdmin = _verify,
    session: AsyncSession = Depends(get_session),
    status: str | None = Query(default=None),
) -> list[PanditAdminOut]:
    stmt = select(Pandit).order_by(Pandit.created_at.desc())
    if status:
        stmt = stmt.where(Pandit.status == status)
    rows = (await session.execute(stmt)).scalars().all()
    out = []
    for p in rows:
        out.append(
            PanditAdminOut(
                id=str(p.id), name=p.name, phone=p.phone, city=p.city,
                status=p.status, availability=p.availability,
                capability_count=await _cap_count(session, p.id),
                verification_reason=p.verification_reason,
                reviewed_by=p.reviewed_by, created_at=p.created_at,
            )
        )
    return out


@router.get("/pandits/{pid}", response_model=PanditOut)
async def get_pandit(
    pid: str,
    _: CurrentAdmin = _verify,
    session: AsyncSession = Depends(get_session),
) -> PanditOut:
    try:
        p = (
            await session.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Partner not found") from None
    if p is None:
        raise NotFoundError("Partner not found")
    return await pandit_out(session, p)


@router.post("/pandits/{pid}/verification-decision", response_model=PanditOut)
async def verification_decision(
    pid: str,
    payload: VerificationDecision,
    request: Request,
    admin: CurrentAdmin = _verify,
    session: AsyncSession = Depends(get_session),
) -> PanditOut:
    try:
        p = (
            await session.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Partner not found") from None
    if p is None:
        raise NotFoundError("Partner not found")

    new_status = _DECISION_STATUS[payload.decision]
    p.status = new_status
    p.verification_reason = payload.reason
    p.reviewed_by = admin.email
    p.reviewed_at = datetime.now(UTC)
    if new_status != PanditStatus.APPROVED:
        p.availability = Availability.OFFLINE  # cannot be live if not approved
    await session.flush()
    await audit(
        session,
        action=MpAudit.VERIFICATION_DECISION,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="pandit",
        entity_id=str(p.id),
        meta={"decision": payload.decision, "reason": payload.reason},
    )
    return await pandit_out(session, p)


# ── Booking operations ───────────────────────────────────────────────────────
async def _booking_admin_out(session: AsyncSession, b: Booking) -> BookingAdminOut:
    cust = (
        await session.execute(select(Customer).where(Customer.id == b.customer_id))
    ).scalar_one_or_none()
    return BookingAdminOut(
        id=str(b.id), code=b.code, status=b.status,
        service_title=b.service_title_snapshot,
        customer_name=cust.name if cust else None,
        customer_phone=cust.phone if cust else "",
        assigned_pandit=await _pandit_brief(session, b.assigned_pandit_id),
        price_display=price_display(b.price_paise), mode=b.mode,
        created_at=b.created_at, confirmed_at=b.confirmed_at,
    )


@router.get("/bookings", response_model=list[BookingAdminOut])
async def list_bookings(
    _: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
    status: str | None = Query(default=None),
) -> list[BookingAdminOut]:
    stmt = select(Booking).order_by(Booking.created_at.desc()).limit(200)
    if status:
        stmt = stmt.where(Booking.status == status)
    rows = (await session.execute(stmt)).scalars().all()
    return [await _booking_admin_out(session, b) for b in rows]


@router.get("/bookings/{bid}", response_model=BookingAdminDetail)
async def booking_detail(
    bid: str,
    _: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
) -> BookingAdminDetail:
    try:
        b = (
            await session.execute(select(Booking).where(Booking.id == uuid.UUID(bid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Booking not found") from None
    if b is None:
        raise NotFoundError("Booking not found")

    base = await _booking_admin_out(session, b)
    events = (
        await session.execute(
            select(BookingEvent).where(BookingEvent.booking_id == b.id).order_by(
                BookingEvent.created_at.asc()
            )
        )
    ).scalars().all()
    attempts = (
        await session.execute(
            select(DispatchAttempt).where(DispatchAttempt.booking_id == b.id).order_by(
                DispatchAttempt.offered_at.asc()
            )
        )
    ).scalars().all()

    attempt_rows = []
    for a in attempts:
        pb = await _pandit_brief(session, a.pandit_id)
        attempt_rows.append(
            DispatchAttemptOut(
                pandit_id=str(a.pandit_id),
                pandit_name=pb.name if pb else None,
                rank=a.rank, distance_km=a.distance_km, outcome=a.outcome,
                offered_at=a.offered_at, expires_at=a.expires_at,
                responded_at=a.responded_at,
            )
        )

    # Live partner location (need-to-know), only while the booking is active.
    live_lat = live_lng = live_fresh = live_eta = None
    if b.assigned_pandit_id and b.status in BookingStatus.ASSIGNED:
        p = (
            await session.execute(select(Pandit).where(Pandit.id == b.assigned_pandit_id))
        ).scalar_one_or_none()
        if p and p.live_lat is not None and p.live_at is not None:
            live_at = p.live_at if p.live_at.tzinfo else p.live_at.replace(tzinfo=UTC)
            live_lat, live_lng = p.live_lat, p.live_lng
            live_fresh = int((datetime.now(UTC) - live_at).total_seconds())
            live_eta = eta_minutes(haversine_km(p.live_lat, p.live_lng, b.dest_lat, b.dest_lng))

    return BookingAdminDetail(
        **base.model_dump(),
        address_line=b.address_line, landmark=b.landmark,
        dest_lat=b.dest_lat, dest_lng=b.dest_lng,
        live_lat=live_lat, live_lng=live_lng,
        live_freshness_seconds=live_fresh, live_eta_minutes=live_eta,
        events=[
            BookingEventOut(
                from_status=e.from_status, to_status=e.to_status,
                actor=e.actor, reason=e.reason, at=e.created_at,
            )
            for e in events
        ],
        attempts=attempt_rows,
    )


@router.post("/bookings/{bid}/reassign", response_model=BookingAdminOut)
async def reassign(
    bid: str,
    payload: ReassignRequest,
    admin: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
) -> BookingAdminOut:
    try:
        b = (
            await session.execute(select(Booking).where(Booking.id == uuid.UUID(bid)))
        ).scalar_one_or_none()
        new_p = (
            await session.execute(
                select(Pandit).where(Pandit.id == uuid.UUID(payload.pandit_id))
            )
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Not found") from None
    if b is None:
        raise NotFoundError("Booking not found")
    if new_p is None:
        raise NotFoundError("Partner not found")
    await dispatch.manual_reassign(
        session, b, new_p, actor=admin.email, reason=payload.reason
    )
    return await _booking_admin_out(session, b)


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(
    _: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
) -> DashboardOut:
    status_rows = (
        await session.execute(
            select(Booking.status, func.count()).group_by(Booking.status)
        )
    ).all()
    by_status = {s: n for s, n in status_rows}
    total = sum(by_status.values())
    no_partner = by_status.get(BookingStatus.NO_PARTNER, 0)

    async def _pc(**filt) -> int:
        stmt = select(func.count()).select_from(Pandit)
        for k, v in filt.items():
            stmt = stmt.where(getattr(Pandit, k) == v)
        return (await session.execute(stmt)).scalar_one()

    pending = (
        await session.execute(
            select(func.count()).select_from(Pandit).where(
                Pandit.status.in_(
                    (
                        PanditStatus.SUBMITTED,
                        PanditStatus.UNDER_REVIEW,
                        PanditStatus.ACTION_REQUIRED,
                    )
                )
            )
        )
    ).scalar_one()

    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    bookings_today = (
        await session.execute(
            select(func.count()).select_from(Booking).where(Booking.created_at >= today)
        )
    ).scalar_one()

    return DashboardOut(
        bookings_by_status=by_status,
        partners_approved=await _pc(status=PanditStatus.APPROVED),
        partners_online=await _pc(availability=Availability.ONLINE),
        partners_busy=await _pc(availability=Availability.BUSY),
        pending_verifications=pending,
        no_match_rate=round(no_partner / total, 3) if total else 0.0,
        bookings_today=bookings_today,
    )
