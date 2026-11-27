"""Admin Partner management CRM (PAN module — 360 view).

A read-focused partner operations surface for ops/verification staff: an
enriched, searchable, sortable, paginated partner directory with live
performance + earnings aggregates, a 360° overview, and sub-resource tabs
(assigned bookings, ratings received, earnings ledger + payout history).

Verification *decisions* (approve/reject/suspend/interview) stay in
``routers/admin.py`` — this router is additive and never mutates partner
status, so it composes with that flow rather than duplicating it. Earnings
figures reuse the finance ledger (single source of truth).

Access: ops / verification (+ super-admin).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.errors import NotFoundError
from app.db.session import get_session
from app.marketplace.constants import (
    Availability,
    BookingStatus,
    LedgerType,
    PanditStatus,
    StaffRole,
)
from app.marketplace.models import (
    Booking,
    LedgerEntry,
    Pandit,
    PanditCapability,
    Payout,
    Review,
)
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    BookingOut,
    CapabilityRef,
    PartnerAdminRow,
    PartnerEarningRow,
    PartnerEarnings,
    PartnerEarningsDetail,
    PartnerListOut,
    PartnerOverview,
    PartnerPayoutRow,
    PartnerPerformance,
    ReviewOut,
)
from app.marketplace.serialize import booking_out
from app.models.service import Service
from app.services.money import price_display

router = APIRouter(prefix="/api/v1/mp/admin/partners", tags=["mp:admin-partners"])

_view = Depends(require_staff(StaffRole.OPS, StaffRole.VERIFICATION))

_CANCELLED = (
    BookingStatus.CANCELLED_CUSTOMER,
    BookingStatus.CANCELLED_PARTNER,
    BookingStatus.CANCELLED_PLATFORM,
)
_SORTS = {
    "created_at": Pandit.created_at,
    "name": Pandit.name,
    "rating": Pandit.rating_sum,
}


def _rating_avg(sum_: int, count: int) -> float | None:
    return round(sum_ / count, 2) if count else None


def _acceptance(received: int, accepted: int) -> float | None:
    return round(accepted / received, 3) if received else None


async def _completed_counts(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, int]:
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(Booking.assigned_pandit_id, func.count())
            .where(
                Booking.assigned_pandit_id.in_(ids),
                Booking.status == BookingStatus.COMPLETED,
            )
            .group_by(Booking.assigned_pandit_id)
        )
    ).all()
    return {str(pid): n for pid, n in rows}


async def _capability_counts(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, int]:
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(PanditCapability.pandit_id, func.count())
            .where(PanditCapability.pandit_id.in_(ids))
            .group_by(PanditCapability.pandit_id)
        )
    ).all()
    return {str(pid): n for pid, n in rows}


async def _outstanding(session: AsyncSession, ids: list[uuid.UUID]) -> dict[str, int]:
    """Unsettled partner-payable per partner (what they are owed)."""
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(LedgerEntry.pandit_id, func.coalesce(func.sum(LedgerEntry.amount_paise), 0))
            .where(
                LedgerEntry.entry_type == LedgerType.PARTNER_PAYABLE,
                LedgerEntry.settled.is_(False),
                LedgerEntry.pandit_id.in_(ids),
            )
            .group_by(LedgerEntry.pandit_id)
        )
    ).all()
    return {str(pid): int(amt or 0) for pid, amt in rows}


async def _load(session: AsyncSession, pid: str) -> Pandit:
    try:
        p = (
            await session.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Partner not found") from None
    if p is None:
        raise NotFoundError("Partner not found")
    return p


@router.get("", response_model=PartnerListOut)
async def list_partners(
    _: CurrentAdmin = _view,
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(default=None, max_length=120),
    status: str | None = Query(default=None),
    availability: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> PartnerListOut:
    base: Select = select(Pandit)
    if q:
        like = f"%{q.strip()}%"
        base = base.where(
            or_(Pandit.name.ilike(like), Pandit.phone.ilike(like), Pandit.city.ilike(like))
        )
    if status in PanditStatus.ALL:
        base = base.where(Pandit.status == status)
    if availability in Availability.ALL:
        base = base.where(Pandit.availability == availability)

    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    col = _SORTS.get(sort, Pandit.created_at)
    base = base.order_by(col.asc() if order == "asc" else col.desc())
    base = base.offset((page - 1) * page_size).limit(page_size)
    partners = (await session.execute(base)).scalars().all()

    ids = [p.id for p in partners]
    caps = await _capability_counts(session, ids)
    completed = await _completed_counts(session, ids)
    outstanding = await _outstanding(session, ids)

    items = [
        PartnerAdminRow(
            id=str(p.id), name=p.name, phone=p.phone, city=p.city, status=p.status,
            availability=p.availability, capability_count=caps.get(str(p.id), 0),
            rating_avg=_rating_avg(p.rating_sum, p.rating_count), rating_count=p.rating_count,
            completed_count=completed.get(str(p.id), 0),
            acceptance_rate=_acceptance(p.offers_received, p.offers_accepted),
            outstanding_paise=outstanding.get(str(p.id), 0),
            outstanding_display=price_display(outstanding.get(str(p.id), 0)),
            created_at=p.created_at,
        )
        for p in partners
    ]
    return PartnerListOut(items=items, total=total, page=page, page_size=page_size)


async def _earnings(session: AsyncSession, pid: uuid.UUID) -> PartnerEarnings:
    lifetime = (
        await session.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount_paise), 0)).where(
                LedgerEntry.entry_type == LedgerType.PARTNER_PAYABLE,
                LedgerEntry.pandit_id == pid,
            )
        )
    ).scalar_one()
    paid_out = (
        await session.execute(
            select(func.coalesce(func.sum(Payout.amount_paise), 0)).where(Payout.pandit_id == pid)
        )
    ).scalar_one()
    outstanding = (
        await session.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount_paise), 0)).where(
                LedgerEntry.entry_type == LedgerType.PARTNER_PAYABLE,
                LedgerEntry.settled.is_(False),
                LedgerEntry.pandit_id == pid,
            )
        )
    ).scalar_one()
    return PartnerEarnings(
        lifetime_earned_paise=int(lifetime),
        lifetime_earned_display=price_display(int(lifetime)),
        paid_out_paise=int(paid_out),
        paid_out_display=price_display(int(paid_out)),
        outstanding_paise=int(outstanding),
        outstanding_display=price_display(int(outstanding)),
    )


@router.get("/{pid}/overview", response_model=PartnerOverview)
async def partner_overview(
    pid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> PartnerOverview:
    p = await _load(session, pid)

    status_counts = dict(
        (
            await session.execute(
                select(Booking.status, func.count())
                .where(Booking.assigned_pandit_id == p.id)
                .group_by(Booking.status)
            )
        ).all()
    )
    completed = status_counts.get(BookingStatus.COMPLETED, 0)
    cancelled = sum(status_counts.get(s, 0) for s in _CANCELLED)
    active = sum(status_counts.get(s, 0) for s in BookingStatus.ASSIGNED)

    caps = (
        await session.execute(
            select(Service)
            .join(PanditCapability, PanditCapability.service_id == Service.id)
            .where(PanditCapability.pandit_id == p.id)
        )
    ).scalars().all()

    return PartnerOverview(
        id=str(p.id), name=p.name, phone=p.phone, city=p.city, status=p.status,
        availability=p.availability, languages=p.languages, base_lat=p.base_lat,
        base_lng=p.base_lng, service_radius_km=p.service_radius_km,
        verification_reason=p.verification_reason, reviewed_by=p.reviewed_by,
        created_at=p.created_at,
        capabilities=[
            CapabilityRef(service_id=str(s.id), slug=s.slug, title=s.title) for s in caps
        ],
        performance=PartnerPerformance(
            offers_received=p.offers_received, offers_accepted=p.offers_accepted,
            acceptance_rate=_acceptance(p.offers_received, p.offers_accepted),
            completed_count=completed, cancelled_count=cancelled, active_count=active,
            rating_avg=_rating_avg(p.rating_sum, p.rating_count), rating_count=p.rating_count,
        ),
        earnings=await _earnings(session, p.id),
    )


@router.get("/{pid}/bookings", response_model=list[BookingOut])
async def partner_bookings(
    pid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[BookingOut]:
    p = await _load(session, pid)
    rows = (
        await session.execute(
            select(Booking).where(Booking.assigned_pandit_id == p.id).order_by(
                Booking.created_at.desc()
            )
        )
    ).scalars().all()
    return [await booking_out(session, b) for b in rows]


@router.get("/{pid}/reviews", response_model=list[ReviewOut])
async def partner_reviews(
    pid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> list[ReviewOut]:
    p = await _load(session, pid)
    rows = (
        await session.execute(
            select(Review, Booking.code)
            .join(Booking, Booking.id == Review.booking_id)
            .where(Review.pandit_id == p.id)
            .order_by(Review.created_at.desc())
        )
    ).all()
    return [
        ReviewOut(
            id=str(r.id), booking_code=code, rating=r.rating, comment=r.comment,
            customer_name=None, pandit_name=p.name, reported=r.reported,
            hidden=r.hidden, created_at=r.created_at,
        )
        for r, code in rows
    ]


@router.get("/{pid}/earnings", response_model=PartnerEarningsDetail)
async def partner_earnings(
    pid: str, _: CurrentAdmin = _view, session: AsyncSession = Depends(get_session)
) -> PartnerEarningsDetail:
    p = await _load(session, pid)
    summary = await _earnings(session, p.id)

    entry_rows = (
        await session.execute(
            select(LedgerEntry, Booking.code)
            .outerjoin(Booking, Booking.id == LedgerEntry.booking_id)
            .where(
                LedgerEntry.pandit_id == p.id,
                LedgerEntry.entry_type.in_((LedgerType.PARTNER_PAYABLE, LedgerType.PAYOUT)),
            )
            .order_by(LedgerEntry.created_at.desc())
            .limit(200)
        )
    ).all()
    payout_rows = (
        await session.execute(
            select(Payout).where(Payout.pandit_id == p.id).order_by(Payout.created_at.desc())
        )
    ).scalars().all()

    return PartnerEarningsDetail(
        summary=summary,
        entries=[
            PartnerEarningRow(
                entry_type=e.entry_type, amount_paise=e.amount_paise,
                amount_display=price_display(e.amount_paise), booking_code=code,
                settled=e.settled, created_at=e.created_at,
            )
            for e, code in entry_rows
        ],
        payouts=[
            PartnerPayoutRow(
                amount_paise=po.amount_paise, amount_display=price_display(po.amount_paise),
                bookings_count=po.bookings_count, status=po.status, created_at=po.created_at,
            )
            for po in payout_rows
        ],
    )
