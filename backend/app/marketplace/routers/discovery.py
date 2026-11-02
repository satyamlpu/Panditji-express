"""Discovery API: catalogue, nearby eligible partners and serviceability."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ContentStatus
from app.core.errors import NotFoundError
from app.db.session import get_session
from app.marketplace.constants import Availability, PanditStatus
from app.marketplace.dispatch import HEARTBEAT_FRESH_SECONDS
from app.marketplace.geo import haversine_km
from app.marketplace.models import Pandit, PanditCapability
from app.marketplace.schemas import PanditSearchItem, Serviceability
from app.models.service import Service
from app.services.money import price_display

router = APIRouter(prefix="/api/v1/mp/discovery", tags=["mp:discovery"])


async def _available_partners(
    session: AsyncSession, service_slug: str, lat: float, lng: float
) -> list[tuple[Pandit, float]]:
    service = (
        await session.execute(
            select(Service).where(
                Service.slug == service_slug, Service.status == ContentStatus.PUBLISHED
            )
        )
    ).scalar_one_or_none()
    if service is None:
        raise NotFoundError("Service not found")

    capable_ids = (
        await session.execute(
            select(PanditCapability.pandit_id).where(
                PanditCapability.service_id == service.id
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
            )
        )
    ).scalars().all()

    cutoff = datetime.now(UTC) - timedelta(seconds=HEARTBEAT_FRESH_SECONDS)
    out: list[tuple[Pandit, float]] = []
    for p in pandits:
        hb = p.last_heartbeat
        if hb and not hb.tzinfo:
            hb = hb.replace(tzinfo=UTC)
        if hb is None or hb < cutoff:
            continue
        dist = haversine_km(p.base_lat, p.base_lng, lat, lng)
        if dist <= p.service_radius_km:
            out.append((p, dist))
    out.sort(key=lambda t: t[1])
    return out


@router.get("/services")
async def services(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (
        await session.execute(
            select(Service)
            .where(Service.status == ContentStatus.PUBLISHED)
            .order_by(Service.sort_order.asc(), Service.title.asc())
        )
    ).scalars().all()
    return [
        {
            "slug": s.slug,
            "title": s.title,
            "summary": s.summary,
            "price_display": price_display(s.price_paise),
            "duration_label": s.duration_label,
        }
        for s in rows
    ]


@router.get("/pandits", response_model=list[PanditSearchItem])
async def search_pandits(
    service_slug: str = Query(...),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    session: AsyncSession = Depends(get_session),
) -> list[PanditSearchItem]:
    found = await _available_partners(session, service_slug, lat, lng)
    return [
        PanditSearchItem(
            id=str(p.id),
            name=p.name,
            languages=p.languages,
            distance_km=round(d, 2),
            service_radius_km=p.service_radius_km,
            rating_avg=round(p.rating_sum / p.rating_count, 2) if p.rating_count else None,
            rating_count=p.rating_count,
        )
        for p, d in found
    ]


@router.get("/serviceability", response_model=Serviceability)
async def serviceability(
    service_slug: str = Query(...),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    session: AsyncSession = Depends(get_session),
) -> Serviceability:
    found = await _available_partners(session, service_slug, lat, lng)
    if found:
        return Serviceability(serviceable=True, available_partners=len(found))
    return Serviceability(
        serviceable=False,
        reason="No available partner near this location right now.",
        available_partners=0,
    )
