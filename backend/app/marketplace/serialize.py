"""Model → schema helpers for the marketplace."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.marketplace.models import Booking, Pandit, PanditCapability
from app.marketplace.schemas import (
    BookingOut,
    CapabilityRef,
    PanditBrief,
    PanditOut,
)
from app.models.service import Service
from app.services.money import price_display


async def _pandit_brief(session: AsyncSession, pandit_id) -> PanditBrief | None:
    if pandit_id is None:
        return None
    p = (await session.execute(select(Pandit).where(Pandit.id == pandit_id))).scalar_one_or_none()
    if p is None:
        return None
    return PanditBrief(id=str(p.id), name=p.name, languages=p.languages)


async def booking_out(session: AsyncSession, b: Booking) -> BookingOut:
    return BookingOut(
        id=str(b.id),
        code=b.code,
        status=b.status,
        service_title=b.service_title_snapshot,
        price_display=price_display(b.price_paise),
        mode=b.mode,
        scheduled_at=b.scheduled_at,
        address_line=b.address_line,
        landmark=b.landmark,
        dest_lat=b.dest_lat,
        dest_lng=b.dest_lng,
        assigned_pandit=await _pandit_brief(session, b.assigned_pandit_id),
        created_at=b.created_at,
        confirmed_at=b.confirmed_at,
    )


async def pandit_out(session: AsyncSession, p: Pandit) -> PanditOut:
    caps = (
        await session.execute(
            select(Service)
            .join(PanditCapability, PanditCapability.service_id == Service.id)
            .where(PanditCapability.pandit_id == p.id)
        )
    ).scalars().all()
    return PanditOut(
        id=str(p.id),
        phone=p.phone,
        name=p.name,
        languages=p.languages,
        city=p.city,
        status=p.status,
        availability=p.availability,
        base_lat=p.base_lat,
        base_lng=p.base_lng,
        service_radius_km=p.service_radius_km,
        rating_avg=round(p.rating_sum / p.rating_count, 2) if p.rating_count else None,
        rating_count=p.rating_count,
        capabilities=[
            CapabilityRef(service_id=str(s.id), slug=s.slug, title=s.title) for s in caps
        ],
    )
