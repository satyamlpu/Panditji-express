"""Live Operations Centre (OPS console).

A real-time operational snapshot for ops staff: partner availability, the booking
queues (dispatching / active / unassigned), stuck-booking alerts, and a map
payload of real partner + destination coordinates. Read-only and additive —
manual (re)assignment reuses the existing ``POST /mp/admin/bookings/{id}/reassign``
endpoint, so nothing here duplicates the dispatch control surface.

All locations, availabilities and ETAs are read from live state — never
fabricated. A partner marker is flagged ``is_live`` only when a fresh GPS ping
exists (on an active booking); otherwise it falls back to the declared base
location and says so. Alert thresholds are configurable query params, not baked
policy.

Access: ops (+ super-admin).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.db.base import utcnow
from app.db.session import get_session
from app.marketplace.constants import Availability, BookingStatus, PanditStatus, StaffRole
from app.marketplace.eta import eta_minutes
from app.marketplace.geo import haversine_km
from app.marketplace.models import Booking, Customer, DispatchAttempt, Pandit
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    OpsActiveBooking,
    OpsAlert,
    OpsBookingCounts,
    OpsDispatchBooking,
    OpsMapDestination,
    OpsMapOut,
    OpsMapPartner,
    OpsOverviewOut,
    OpsPartnerCounts,
    OpsUnassignedBooking,
)

router = APIRouter(prefix="/api/v1/mp/admin/ops", tags=["mp:admin-ops"])

_ops = Depends(require_staff(StaffRole.OPS))

_ACTIVE = BookingStatus.ASSIGNED  # confirmed, en_route, arrived, in_progress
_DISPATCHING = BookingStatus.DISPATCHING  # searching, awaiting_acceptance


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _age_seconds(dt: datetime | None) -> int | None:
    a = _aware(dt)
    return int((datetime.now(UTC) - a).total_seconds()) if a else None


async def _partner_counts(session: AsyncSession) -> OpsPartnerCounts:
    rows = dict(
        (
            await session.execute(
                select(Pandit.availability, func.count())
                .where(Pandit.status == PanditStatus.APPROVED)
                .group_by(Pandit.availability)
            )
        ).all()
    )
    return OpsPartnerCounts(
        online=rows.get(Availability.ONLINE, 0),
        busy=rows.get(Availability.BUSY, 0),
        offline=rows.get(Availability.OFFLINE, 0),
        unavailable=rows.get(Availability.UNAVAILABLE, 0),
        approved_total=sum(rows.values()),
    )


async def _offer_info(session: AsyncSession, booking_id) -> tuple[int, str | None]:
    """(# live offers, latest-offered partner name) for a dispatching booking."""
    offers = (
        await session.execute(
            select(DispatchAttempt)
            .where(
                DispatchAttempt.booking_id == booking_id,
                DispatchAttempt.outcome == "offered",
            )
            .order_by(DispatchAttempt.offered_at.desc())
        )
    ).scalars().all()
    name = None
    if offers:
        p = (
            await session.execute(select(Pandit).where(Pandit.id == offers[0].pandit_id))
        ).scalar_one_or_none()
        name = p.name if p else None
    return len(offers), name


@router.get("/overview", response_model=OpsOverviewOut)
async def ops_overview(
    _: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
    dispatch_alert_seconds: int = Query(default=120, ge=10, le=3600),
    stale_location_seconds: int = Query(default=120, ge=30, le=3600),
) -> OpsOverviewOut:
    partners = await _partner_counts(session)

    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    status_counts = dict(
        (
            await session.execute(
                select(Booking.status, func.count()).group_by(Booking.status)
            )
        ).all()
    )
    completed_today = (
        await session.execute(
            select(func.count())
            .select_from(Booking)
            .where(Booking.status == BookingStatus.COMPLETED, Booking.created_at >= today)
        )
    ).scalar_one()
    scheduled_upcoming = (
        await session.execute(
            select(func.count())
            .select_from(Booking)
            .where(Booking.mode == "scheduled", Booking.status.in_(_DISPATCHING + _ACTIVE))
        )
    ).scalar_one()

    counts = OpsBookingCounts(
        dispatching=sum(status_counts.get(s, 0) for s in _DISPATCHING),
        active=sum(status_counts.get(s, 0) for s in _ACTIVE),
        unassigned=status_counts.get(BookingStatus.NO_PARTNER, 0),
        scheduled_upcoming=scheduled_upcoming,
        completed_today=completed_today,
    )

    # Active bookings (a partner is committed) — include live location + ETA.
    active_rows = (
        await session.execute(
            select(Booking).where(Booking.status.in_(_ACTIVE)).order_by(Booking.created_at.asc())
        )
    ).scalars().all()
    active: list[OpsActiveBooking] = []
    alerts: list[OpsAlert] = []
    for b in active_rows:
        cust = (
            await session.execute(select(Customer).where(Customer.id == b.customer_id))
        ).scalar_one_or_none()
        p = (
            await session.execute(select(Pandit).where(Pandit.id == b.assigned_pandit_id))
        ).scalar_one_or_none() if b.assigned_pandit_id else None
        live_lat = live_lng = live_fresh = eta = None
        if p and p.live_lat is not None and p.live_at is not None:
            live_lat, live_lng = p.live_lat, p.live_lng
            live_fresh = _age_seconds(p.live_at)
            eta = eta_minutes(haversine_km(p.live_lat, p.live_lng, b.dest_lat, b.dest_lng))
        active.append(
            OpsActiveBooking(
                id=str(b.id), code=b.code, status=b.status,
                customer_name=cust.name if cust else None,
                partner_id=str(p.id) if p else None,
                partner_name=p.name if p else None,
                live_lat=live_lat, live_lng=live_lng, live_fresh_seconds=live_fresh,
                eta_minutes=eta, dest_lat=b.dest_lat, dest_lng=b.dest_lng,
            )
        )
        # Alert: partner is en-route/arrived but their location is stale or absent.
        if b.status in (BookingStatus.EN_ROUTE, BookingStatus.ARRIVED) and (
            live_fresh is None or live_fresh > stale_location_seconds
        ):
            alerts.append(
                OpsAlert(
                    id=str(b.id), code=b.code, status=b.status, kind="stale_location",
                    since_seconds=live_fresh,
                )
            )

    # Dispatching bookings — still searching / awaiting acceptance.
    disp_rows = (
        await session.execute(
            select(Booking).where(Booking.status.in_(_DISPATCHING)).order_by(
                Booking.created_at.asc()
            )
        )
    ).scalars().all()
    dispatching: list[OpsDispatchBooking] = []
    for b in disp_rows:
        n_offers, offer_name = await _offer_info(session, b.id)
        waiting = _age_seconds(b.created_at) or 0
        dispatching.append(
            OpsDispatchBooking(
                id=str(b.id), code=b.code, status=b.status, created_at=b.created_at,
                waiting_seconds=waiting, offers_count=n_offers, current_partner_name=offer_name,
            )
        )
        if waiting > dispatch_alert_seconds:
            alerts.append(
                OpsAlert(
                    id=str(b.id), code=b.code, status=b.status, kind="stuck_dispatch",
                    since_seconds=waiting,
                )
            )

    # Unassigned — dispatch gave up (most recent 50 need a human to re-dispatch).
    unassigned_rows = (
        await session.execute(
            select(Booking).where(Booking.status == BookingStatus.NO_PARTNER).order_by(
                Booking.created_at.desc()
            ).limit(50)
        )
    ).scalars().all()
    unassigned: list[OpsUnassignedBooking] = []
    for b in unassigned_rows:
        age = _age_seconds(b.created_at) or 0
        unassigned.append(
            OpsUnassignedBooking(
                id=str(b.id), code=b.code, status=b.status, created_at=b.created_at,
                waiting_seconds=age,
            )
        )
        alerts.append(
            OpsAlert(
                id=str(b.id), code=b.code, status=b.status, kind="no_partner",
                since_seconds=age,
            )
        )

    alerts.sort(key=lambda a: a.since_seconds or 0, reverse=True)
    return OpsOverviewOut(
        generated_at=datetime.now(UTC),
        partners=partners,
        bookings=counts,
        active=active,
        dispatching=dispatching,
        unassigned=unassigned,
        alerts=alerts,
    )


@router.get("/map", response_model=OpsMapOut)
async def ops_map(
    _: CurrentAdmin = _ops, session: AsyncSession = Depends(get_session)
) -> OpsMapOut:
    """Real coordinates only: online/busy partners (live ping if on an active
    booking, else declared base) and the destinations of in-flight bookings."""
    partners_rows = (
        await session.execute(
            select(Pandit).where(
                Pandit.status == PanditStatus.APPROVED,
                Pandit.availability.in_((Availability.ONLINE, Availability.BUSY)),
            )
        )
    ).scalars().all()

    # Which partners are on an active booking (→ their live ping is meaningful).
    active_partner_ids = {
        str(pid)
        for (pid,) in (
            await session.execute(
                select(Booking.assigned_pandit_id).where(
                    Booking.status.in_(_ACTIVE), Booking.assigned_pandit_id.is_not(None)
                )
            )
        ).all()
    }

    partners: list[OpsMapPartner] = []
    coords: list[tuple[float, float]] = []
    for p in partners_rows:
        on_active = str(p.id) in active_partner_ids
        if on_active and p.live_lat is not None and p.live_lng is not None:
            lat, lng, is_live = p.live_lat, p.live_lng, True
        elif p.base_lat is not None and p.base_lng is not None:
            lat, lng, is_live = p.base_lat, p.base_lng, False
        else:
            continue  # no real coordinate to show — skip rather than invent one
        coords.append((lat, lng))
        partners.append(
            OpsMapPartner(
                id=str(p.id), name=p.name, availability=p.availability,
                lat=lat, lng=lng, is_live=is_live,
            )
        )

    dest_rows = (
        await session.execute(
            select(Booking).where(Booking.status.in_(_ACTIVE + _DISPATCHING))
        )
    ).scalars().all()
    destinations = [
        OpsMapDestination(code=b.code, lat=b.dest_lat, lng=b.dest_lng, status=b.status)
        for b in dest_rows
    ]
    coords.extend((b.dest_lat, b.dest_lng) for b in dest_rows)

    center_lat = sum(c[0] for c in coords) / len(coords) if coords else None
    center_lng = sum(c[1] for c in coords) / len(coords) if coords else None
    return OpsMapOut(
        center_lat=center_lat, center_lng=center_lng,
        partners=partners, destinations=destinations,
    )
