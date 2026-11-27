"""Admin Service Areas (managed serviceability catalogue).

CRUD for named operational areas (centre + radius + optional pincodes + active
toggle), plus a coverage check that reports which active areas cover a point. This
is a *managed catalogue* on top of the existing per-partner radius — it does NOT
gate booking/dispatch here; serviceability enforcement against these areas is a
separate, decided change. All mutations are audited (ops / super-admin).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.errors import NotFoundError
from app.db.session import get_session
from app.marketplace.constants import StaffRole
from app.marketplace.geo import haversine_km
from app.marketplace.models import ServiceArea
from app.marketplace.principals import client_ip, require_staff
from app.marketplace.schemas import (
    CoverageOut,
    ServiceAreaCreate,
    ServiceAreaOut,
    ServiceAreaUpdate,
)
from app.schemas.common import MessageResponse
from app.services.audit import audit

router = APIRouter(prefix="/api/v1/mp/admin/service-areas", tags=["mp:admin-service-areas"])

_ops = Depends(require_staff(StaffRole.OPS))

_AUDIT_CREATE = "mp.service_area.create"
_AUDIT_UPDATE = "mp.service_area.update"
_AUDIT_DELETE = "mp.service_area.delete"


def _out(a: ServiceArea) -> ServiceAreaOut:
    return ServiceAreaOut(
        id=str(a.id), name=a.name, city=a.city, center_lat=a.center_lat,
        center_lng=a.center_lng, radius_km=a.radius_km, pincodes=a.pincodes or [],
        active=a.active, notes=a.notes, created_at=a.created_at,
    )


async def _load(session: AsyncSession, aid: str) -> ServiceArea:
    try:
        a = (
            await session.execute(select(ServiceArea).where(ServiceArea.id == uuid.UUID(aid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Service area not found") from None
    if a is None:
        raise NotFoundError("Service area not found")
    return a


@router.get("", response_model=list[ServiceAreaOut])
async def list_areas(
    _: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
    active: bool | None = Query(default=None),
) -> list[ServiceAreaOut]:
    stmt = select(ServiceArea).order_by(ServiceArea.created_at.desc())
    if active is not None:
        stmt = stmt.where(ServiceArea.active.is_(active))
    rows = (await session.execute(stmt)).scalars().all()
    return [_out(a) for a in rows]


@router.post("", response_model=ServiceAreaOut, status_code=201)
async def create_area(
    payload: ServiceAreaCreate,
    request: Request,
    admin: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
) -> ServiceAreaOut:
    a = ServiceArea(
        name=payload.name, city=payload.city, center_lat=payload.center_lat,
        center_lng=payload.center_lng, radius_km=payload.radius_km,
        pincodes=payload.pincodes or None, active=payload.active, notes=payload.notes,
    )
    session.add(a)
    await session.flush()
    await audit(
        session, action=_AUDIT_CREATE, actor_id=admin.id, actor_email=admin.email,
        entity="service_area", entity_id=str(a.id), ip=client_ip(request),
        meta={"name": a.name, "radius_km": a.radius_km},
    )
    return _out(a)


@router.get("/coverage", response_model=CoverageOut)
async def coverage(
    _: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
) -> CoverageOut:
    """Which active areas cover this point (centre-distance ≤ radius)."""
    rows = (
        await session.execute(select(ServiceArea).where(ServiceArea.active.is_(True)))
    ).scalars().all()
    matching = [
        a for a in rows
        if haversine_km(lat, lng, a.center_lat, a.center_lng) <= a.radius_km
    ]
    return CoverageOut(
        lat=lat, lng=lng, covered=bool(matching), areas=[_out(a) for a in matching]
    )


@router.get("/{aid}", response_model=ServiceAreaOut)
async def get_area(
    aid: str, _: CurrentAdmin = _ops, session: AsyncSession = Depends(get_session)
) -> ServiceAreaOut:
    return _out(await _load(session, aid))


@router.patch("/{aid}", response_model=ServiceAreaOut)
async def update_area(
    aid: str,
    payload: ServiceAreaUpdate,
    request: Request,
    admin: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
) -> ServiceAreaOut:
    a = await _load(session, aid)
    data = payload.model_dump(exclude_unset=True)
    if "pincodes" in data:
        data["pincodes"] = data["pincodes"] or None
    for k, v in data.items():
        setattr(a, k, v)
    await session.flush()
    await audit(
        session, action=_AUDIT_UPDATE, actor_id=admin.id, actor_email=admin.email,
        entity="service_area", entity_id=str(a.id), ip=client_ip(request),
        meta={"changed": list(data.keys())},
    )
    return _out(a)


@router.delete("/{aid}", response_model=MessageResponse)
async def delete_area(
    aid: str,
    request: Request,
    admin: CurrentAdmin = _ops,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    a = await _load(session, aid)
    name = a.name
    await session.delete(a)
    await audit(
        session, action=_AUDIT_DELETE, actor_id=admin.id, actor_email=admin.email,
        entity="service_area", entity_id=aid, ip=client_ip(request), meta={"name": name},
    )
    return MessageResponse(message="Service area deleted")
