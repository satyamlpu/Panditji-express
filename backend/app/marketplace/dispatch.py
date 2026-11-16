"""Booking + dispatch engine (SRS §4, DSP module).

Design notes
------------
* Confirmation requires a *committed* backend assignment, not just a partner tap.
* Offers have a bounded expiry; stale acceptances are rejected.
* Each booking offers one partner at a time, retrying down a ranked candidate
  list up to a limit, then reporting the real no-match state.
* Accept is guarded on two independent levels so a booking can never be
  double-assigned: (1) the booking row is locked with ``SELECT … FOR UPDATE``
  for the duration of the accept, so concurrent accepts serialize and the loser
  re-reads a no-longer-awaiting booking and gets a clean 409; (2) a partial
  unique index (``uq_dispatch_one_accepted``) rejects a second ACCEPTED attempt
  at the database, the durable backstop if the guard is ever bypassed. On
  SQLite ``FOR UPDATE`` is a no-op (its single writer serializes anyway) and the
  unique index is the guarantee; on PostgreSQL both apply.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import APIError, ConflictError, NotFoundError
from app.marketplace.constants import (
    Availability,
    BookingStatus,
    DispatchOutcome,
    MpAudit,
    PanditStatus,
)
from app.marketplace.geo import haversine_km
from app.marketplace.models import (
    Booking,
    BookingEvent,
    DispatchAttempt,
    Pandit,
    PanditCapability,
)
from app.marketplace.notify import notify_customer, notify_pandit
from app.services.audit import audit

OFFER_TTL_SECONDS = 60
MAX_DISPATCH_ATTEMPTS = 5
HEARTBEAT_FRESH_SECONDS = 120


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; treat stored values as UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


async def record_event(
    session: AsyncSession,
    booking: Booking,
    to_status: str,
    *,
    actor: str,
    reason: str | None = None,
    meta: dict | None = None,
) -> None:
    session.add(
        BookingEvent(
            booking_id=booking.id,
            from_status=booking.status,
            to_status=to_status,
            actor=actor,
            reason=reason,
            meta=meta,
        )
    )
    booking.status = to_status
    await session.flush()


async def _already_offered_ids(session: AsyncSession, booking: Booking) -> set:
    rows = (
        await session.execute(
            select(DispatchAttempt.pandit_id).where(
                DispatchAttempt.booking_id == booking.id
            )
        )
    ).scalars().all()
    return set(rows)


def _use_postgis() -> bool:
    """PostGIS radius filter only when configured AND on PostgreSQL."""
    return (
        settings.geo_backend == "postgis"
        and settings.database_url.startswith("postgresql")
    )


async def _within_range_haversine(
    session: AsyncSession, booking: Booking, fresh_cutoff: datetime
) -> list[Pandit]:
    """Eligible partners within range, scanned in Python (dev/SQLite)."""
    capable_ids = (
        await session.execute(
            select(PanditCapability.pandit_id).where(
                PanditCapability.service_id == booking.service_id
            )
        )
    ).scalars().all()
    if not capable_ids:
        return []
    pandits = (
        await session.execute(
            select(Pandit).where(
                Pandit.id.in_(capable_ids),
                Pandit.status == PanditStatus.APPROVED,
                Pandit.availability == Availability.ONLINE,
                Pandit.base_lat.is_not(None),
                Pandit.base_lng.is_not(None),
            )
        )
    ).scalars().all()
    out: list[Pandit] = []
    for p in pandits:
        hb = _aware(p.last_heartbeat)
        if hb is None or hb < fresh_cutoff:
            continue
        dist = haversine_km(p.base_lat, p.base_lng, booking.dest_lat, booking.dest_lng)
        if dist > p.service_radius_km:
            continue
        out.append(p)
    return out


async def _within_range_postgis(
    session: AsyncSession, booking: Booking, fresh_cutoff: datetime
) -> list[Pandit]:
    """Eligible partners within range via an indexed ST_DWithin filter (prod).

    The GiST index on ``mp_pandit.base_geog`` does the radius scan in the
    database; ranking distance is still the shared haversine so results match
    the dev path exactly.
    """
    stmt = (
        select(Pandit)
        .join(PanditCapability, PanditCapability.pandit_id == Pandit.id)
        .where(
            PanditCapability.service_id == booking.service_id,
            Pandit.status == PanditStatus.APPROVED,
            Pandit.availability == Availability.ONLINE,
            Pandit.last_heartbeat >= fresh_cutoff,
            text(
                "mp_pandit.base_geog IS NOT NULL AND ST_DWithin("
                "mp_pandit.base_geog, "
                "ST_SetSRID(ST_MakePoint(:dest_lng, :dest_lat), 4326)::geography, "
                "mp_pandit.service_radius_km * 1000)"
            ).bindparams(dest_lng=booking.dest_lng, dest_lat=booking.dest_lat),
        )
    )
    return (await session.execute(stmt)).scalars().all()


async def _rank_candidates(
    session: AsyncSession, booking: Booking, exclude: set
) -> list[tuple[Pandit, float]]:
    """Eligible, bookable partners for this booking, best first.

    Filters: approved, online, fresh heartbeat, capable of the service, within
    their travel radius, not already offered this booking. Ranking: nearest
    first, then higher acceptance rate, then lighter workload. The radius filter
    runs in Python (haversine) or in the database (PostGIS); ranking is shared.
    """
    fresh_cutoff = _now() - timedelta(seconds=HEARTBEAT_FRESH_SECONDS)
    if _use_postgis():
        pandits = await _within_range_postgis(session, booking, fresh_cutoff)
    else:
        pandits = await _within_range_haversine(session, booking, fresh_cutoff)

    scored: list[tuple[Pandit, float]] = []
    for p in pandits:
        if p.id in exclude:
            continue
        dist = haversine_km(p.base_lat, p.base_lng, booking.dest_lat, booking.dest_lng)
        scored.append((p, dist))

    def accept_rate(p: Pandit) -> float:
        return (p.offers_accepted / p.offers_received) if p.offers_received else 0.5

    scored.sort(key=lambda t: (round(t[1], 3), -accept_rate(t[0]), t[0].offers_received))
    return scored


async def _make_offer(
    session: AsyncSession, booking: Booking, pandit: Pandit, distance: float, rank: int
) -> DispatchAttempt:
    now = _now()
    attempt = DispatchAttempt(
        booking_id=booking.id,
        pandit_id=pandit.id,
        rank=rank,
        distance_km=round(distance, 2),
        offered_at=now,
        expires_at=now + timedelta(seconds=OFFER_TTL_SECONDS),
        outcome=DispatchOutcome.OFFERED,
    )
    session.add(attempt)
    pandit.offers_received += 1
    await record_event(
        session,
        booking,
        BookingStatus.AWAITING_ACCEPTANCE,
        actor="system",
        reason="offer_sent",
        meta={"pandit_id": str(pandit.id), "distance_km": round(distance, 2)},
    )
    await audit(
        session,
        action=MpAudit.DISPATCH_OFFER,
        entity="booking",
        entity_id=str(booking.id),
        meta={"pandit_id": str(pandit.id), "rank": rank},
    )
    await notify_pandit(
        session, pandit.id, kind="offer", title="New puja request",
        body=f"{booking.service_title_snapshot} · ~{round(distance, 1)} km away",
        booking_id=booking.id,
    )
    return attempt


async def _offer_next_or_fail(session: AsyncSession, booking: Booking) -> None:
    """Offer the next eligible candidate, or settle as no-match."""
    attempts = (
        await session.execute(
            select(func.count()).select_from(DispatchAttempt).where(
                DispatchAttempt.booking_id == booking.id
            )
        )
    ).scalar_one()
    if attempts >= MAX_DISPATCH_ATTEMPTS:
        await _no_partner(session, booking, reason="attempt_limit")
        return

    exclude = await _already_offered_ids(session, booking)
    candidates = await _rank_candidates(session, booking, exclude)
    if not candidates:
        await _no_partner(session, booking, reason="no_eligible_partner")
        return
    pandit, dist = candidates[0]
    await _make_offer(session, booking, pandit, dist, rank=attempts + 1)


async def _no_partner(session: AsyncSession, booking: Booking, *, reason: str) -> None:
    await record_event(
        session, booking, BookingStatus.NO_PARTNER, actor="system", reason=reason
    )
    await audit(
        session,
        action=MpAudit.DISPATCH_NO_PARTNER,
        entity="booking",
        entity_id=str(booking.id),
        meta={"reason": reason},
    )
    await notify_customer(
        session, booking.customer_id, kind="no_partner",
        title="No pandit available right now",
        body="We couldn't find an available pandit. Please try again shortly or schedule.",
        booking_id=booking.id,
    )


async def start_dispatch(session: AsyncSession, booking: Booking) -> None:
    """Begin dispatch for a freshly-created immediate booking."""
    await record_event(
        session, booking, BookingStatus.SEARCHING, actor="system", reason="dispatch_start"
    )
    await _offer_next_or_fail(session, booking)


async def _active_offer(session: AsyncSession, booking: Booking) -> DispatchAttempt | None:
    return (
        await session.execute(
            select(DispatchAttempt)
            .where(
                DispatchAttempt.booking_id == booking.id,
                DispatchAttempt.outcome == DispatchOutcome.OFFERED,
            )
            .order_by(DispatchAttempt.offered_at.desc())
        )
    ).scalars().first()


async def tick(session: AsyncSession, booking: Booking) -> None:
    """Lazily expire a stale offer and advance (no background worker in Phase 1).

    Safe to call on any read of the booking; a no-op unless an offer has expired.
    """
    if booking.status != BookingStatus.AWAITING_ACCEPTANCE:
        return
    offer = await _active_offer(session, booking)
    if offer is None:
        await _offer_next_or_fail(session, booking)
        return
    if _aware(offer.expires_at) <= _now():
        offer.outcome = DispatchOutcome.EXPIRED
        offer.responded_at = _now()
        await session.flush()
        await _offer_next_or_fail(session, booking)


async def accept_offer(session: AsyncSession, pandit: Pandit, booking_id) -> Booking:
    """A partner accepts their live offer. Confirms only if still valid + free.

    Locks the booking row so concurrent accepts serialize; a partial unique
    index is the durable backstop against double-assignment (see module docs).
    """
    booking = (
        await session.execute(
            select(Booking).where(Booking.id == booking_id).with_for_update()
        )
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("Booking not found")

    offer = (
        await session.execute(
            select(DispatchAttempt).where(
                DispatchAttempt.booking_id == booking_id,
                DispatchAttempt.pandit_id == pandit.id,
                DispatchAttempt.outcome == DispatchOutcome.OFFERED,
            )
        )
    ).scalars().first()
    if offer is None:
        raise ConflictError("No active offer for you on this booking")

    # Guards: booking still awaiting, offer not expired, partner still free.
    if booking.status != BookingStatus.AWAITING_ACCEPTANCE:
        offer.outcome = DispatchOutcome.SUPERSEDED
        await session.flush()
        raise ConflictError("This booking is no longer awaiting acceptance")
    if _aware(offer.expires_at) <= _now():
        offer.outcome = DispatchOutcome.EXPIRED
        offer.responded_at = _now()
        await session.flush()
        await _offer_next_or_fail(session, booking)
        raise ConflictError("Your offer has expired")
    if pandit.availability == Availability.BUSY:
        raise ConflictError("You already have an active booking")

    # Commit the assignment.
    offer.outcome = DispatchOutcome.ACCEPTED
    offer.responded_at = _now()
    pandit.offers_accepted += 1
    pandit.availability = Availability.BUSY
    booking.assigned_pandit_id = pandit.id
    booking.confirmed_at = _now()
    await record_event(
        session,
        booking,
        BookingStatus.CONFIRMED,
        actor="pandit",
        reason="accepted",
        meta={"pandit_id": str(pandit.id)},
    )
    # Supersede any other open offers for this booking.
    for other in (
        await session.execute(
            select(DispatchAttempt).where(
                DispatchAttempt.booking_id == booking.id,
                DispatchAttempt.outcome == DispatchOutcome.OFFERED,
            )
        )
    ).scalars().all():
        other.outcome = DispatchOutcome.SUPERSEDED
    await audit(
        session,
        action=MpAudit.DISPATCH_ACCEPT,
        actor_id=str(pandit.id),
        entity="booking",
        entity_id=str(booking.id),
    )
    await notify_customer(
        session, booking.customer_id, kind="confirmed", title="Pandit confirmed",
        body=f"{pandit.name or 'Your pandit'} will perform your "
        f"{booking.service_title_snapshot}.",
        booking_id=booking.id,
    )
    try:
        await session.flush()
    except IntegrityError as exc:
        # uq_dispatch_one_accepted: another partner's accept won the race first.
        await session.rollback()
        raise ConflictError(
            "This booking was just confirmed with another partner"
        ) from exc
    return booking


async def reject_offer(session: AsyncSession, pandit: Pandit, booking_id) -> None:
    offer = (
        await session.execute(
            select(DispatchAttempt).where(
                DispatchAttempt.booking_id == booking_id,
                DispatchAttempt.pandit_id == pandit.id,
                DispatchAttempt.outcome == DispatchOutcome.OFFERED,
            )
        )
    ).scalars().first()
    if offer is None:
        raise ConflictError("No active offer for you on this booking")
    offer.outcome = DispatchOutcome.REJECTED
    offer.responded_at = _now()
    await session.flush()
    booking = (
        await session.execute(select(Booking).where(Booking.id == booking_id))
    ).scalar_one()
    await audit(
        session,
        action=MpAudit.DISPATCH_REJECT,
        actor_id=str(pandit.id),
        entity="booking",
        entity_id=str(booking.id),
    )
    if booking.status == BookingStatus.AWAITING_ACCEPTANCE:
        await _offer_next_or_fail(session, booking)


# ── Status transitions after confirmation ──────────────────────────────────--
_ADVANCE = {
    BookingStatus.CONFIRMED: BookingStatus.EN_ROUTE,
    BookingStatus.EN_ROUTE: BookingStatus.ARRIVED,
    BookingStatus.ARRIVED: BookingStatus.IN_PROGRESS,
    BookingStatus.IN_PROGRESS: BookingStatus.COMPLETED,
}


async def advance_status(
    session: AsyncSession, booking: Booking, to_status: str, *, actor: str
) -> Booking:
    expected = _ADVANCE.get(booking.status)
    if expected is None or to_status != expected:
        raise APIError(
            f"Cannot move a {booking.status} booking to {to_status}",
            code="invalid_transition",
            status_code=409,
        )
    await record_event(session, booking, to_status, actor=actor, reason="status_advance")
    await audit(
        session,
        action=MpAudit.STATUS_ADVANCE,
        entity="booking",
        entity_id=str(booking.id),
        meta={"to": to_status},
    )
    _msg = {
        BookingStatus.EN_ROUTE: ("Pandit on the way", "Your pandit is heading to you."),
        BookingStatus.ARRIVED: ("Pandit has arrived", "Your pandit has reached the location."),
        BookingStatus.IN_PROGRESS: ("Puja started", "Your puja is now in progress."),
        BookingStatus.COMPLETED: ("Puja completed", "Thank you — your puja is complete."),
    }.get(to_status)
    if _msg:
        await notify_customer(
            session, booking.customer_id, kind=to_status, title=_msg[0],
            body=_msg[1], booking_id=booking.id,
        )
    if to_status == BookingStatus.COMPLETED and booking.assigned_pandit_id:
        pandit = (
            await session.execute(
                select(Pandit).where(Pandit.id == booking.assigned_pandit_id)
            )
        ).scalar_one_or_none()
        if pandit:
            pandit.availability = Availability.ONLINE  # free for new work
            _clear_live_location(pandit)  # tracking lifecycle ends
    await session.flush()
    return booking


def _clear_live_location(pandit: Pandit) -> None:
    pandit.live_lat = None
    pandit.live_lng = None
    pandit.live_accuracy_m = None
    pandit.live_at = None


async def cancel_booking(
    session: AsyncSession, booking: Booking, *, to_status: str, actor: str, reason: str | None
) -> Booking:
    if booking.status in BookingStatus.TERMINAL:
        raise ConflictError("Booking is already closed")
    freed = booking.assigned_pandit_id
    booking.cancel_reason = reason
    await record_event(session, booking, to_status, actor=actor, reason=reason)
    # free the partner + supersede any open offers
    if freed:
        pandit = (
            await session.execute(select(Pandit).where(Pandit.id == freed))
        ).scalar_one_or_none()
        if pandit:
            if pandit.availability == Availability.BUSY:
                pandit.availability = Availability.ONLINE
            _clear_live_location(pandit)
            await notify_pandit(
                session, pandit.id, kind="cancelled",
                title="Booking cancelled", body=f"{booking.code} was cancelled.",
                booking_id=booking.id,
            )
    # Tell the customer unless they are the one who cancelled.
    if actor != "customer":
        await notify_customer(
            session, booking.customer_id, kind="cancelled",
            title="Booking cancelled", body=reason or f"{booking.code} was cancelled.",
            booking_id=booking.id,
        )
    for other in (
        await session.execute(
            select(DispatchAttempt).where(
                DispatchAttempt.booking_id == booking.id,
                DispatchAttempt.outcome == DispatchOutcome.OFFERED,
            )
        )
    ).scalars().all():
        other.outcome = DispatchOutcome.SUPERSEDED
    await audit(
        session,
        action=MpAudit.BOOKING_CANCEL,
        entity="booking",
        entity_id=str(booking.id),
        meta={"to": to_status},
    )
    await session.flush()
    return booking


async def manual_reassign(
    session: AsyncSession,
    booking: Booking,
    new_pandit: Pandit,
    *,
    actor: str,
    reason: str,
    actor_id: str | None = None,
    ip: str | None = None,
) -> Booking:
    """Ops reassigns an assigned/dispatching booking to a specific partner.

    Validates eligibility and prevents double assignment; fully audited.
    """
    if new_pandit.status != PanditStatus.APPROVED:
        raise APIError("Partner is not approved", code="not_eligible", status_code=409)
    if new_pandit.availability == Availability.BUSY:
        raise ConflictError("Target partner already has an active booking")
    # capability check
    capable = (
        await session.execute(
            select(PanditCapability.id).where(
                PanditCapability.pandit_id == new_pandit.id,
                PanditCapability.service_id == booking.service_id,
            )
        )
    ).first()
    if not capable:
        raise APIError(
            "Partner cannot perform this service", code="not_eligible", status_code=409
        )

    previous = booking.assigned_pandit_id
    if previous and previous != new_pandit.id:
        prev = (
            await session.execute(select(Pandit).where(Pandit.id == previous))
        ).scalar_one_or_none()
        if prev and prev.availability == Availability.BUSY:
            prev.availability = Availability.ONLINE
            _clear_live_location(prev)

    # supersede open offers
    for other in (
        await session.execute(
            select(DispatchAttempt).where(
                DispatchAttempt.booking_id == booking.id,
                DispatchAttempt.outcome == DispatchOutcome.OFFERED,
            )
        )
    ).scalars().all():
        other.outcome = DispatchOutcome.SUPERSEDED

    new_pandit.availability = Availability.BUSY
    booking.assigned_pandit_id = new_pandit.id
    if booking.confirmed_at is None:
        booking.confirmed_at = _now()
    await record_event(
        session,
        booking,
        BookingStatus.CONFIRMED,
        actor=actor,
        reason=f"manual_reassign: {reason}",
        meta={"pandit_id": str(new_pandit.id), "previous": str(previous) if previous else None},
    )
    await audit(
        session,
        action=MpAudit.MANUAL_REASSIGN,
        actor_id=actor_id,
        actor_email=actor,
        entity="booking",
        entity_id=str(booking.id),
        ip=ip,
        meta={"to_pandit": str(new_pandit.id)},
    )
    await notify_pandit(
        session, new_pandit.id, kind="assigned", title="You've been assigned a booking",
        body=f"{booking.service_title_snapshot} ({booking.code}).", booking_id=booking.id,
    )
    await notify_customer(
        session, booking.customer_id, kind="reassigned", title="Your pandit was updated",
        body=f"{new_pandit.name or 'A pandit'} will perform your "
        f"{booking.service_title_snapshot}.", booking_id=booking.id,
    )
    await session.flush()
    return booking
