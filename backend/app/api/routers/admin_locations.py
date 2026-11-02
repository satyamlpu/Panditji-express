"""Admin CRUD for service-area locations, including which services they offer."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import apply_status_timestamp, parse_uuid, queue_revalidate
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import Audit, ContentStatus
from app.core.errors import ConflictError, NotFoundError
from app.db.base import utcnow
from app.db.session import get_session
from app.models.location import Location, ServiceLocation
from app.models.redirect import Redirect
from app.models.service import Service
from app.schemas.admin import (
    LocationCreate,
    LocationOut,
    LocationUpdate,
    ServiceAssociationUpdate,
)
from app.schemas.common import MessageResponse
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/locations",
    tags=["admin:locations"],
    dependencies=[Depends(require_admin)],
)

TAGS = ["locations"]


async def _service_ids(session: AsyncSession, location_id) -> list[str]:
    rows = (
        await session.execute(
            select(ServiceLocation.service_id).where(
                ServiceLocation.location_id == location_id
            )
        )
    ).scalars().all()
    return [str(r) for r in rows]


async def _out(session: AsyncSession, loc: Location) -> LocationOut:
    return LocationOut(
        id=str(loc.id),
        slug=loc.slug,
        city=loc.city,
        region=loc.region,
        description=loc.description,
        sort_order=loc.sort_order,
        status=loc.status,
        seo_title=loc.seo_title,
        seo_description=loc.seo_description,
        service_ids=await _service_ids(session, loc.id),
        created_at=loc.created_at,
        updated_at=loc.updated_at,
    )


async def _load(session: AsyncSession, lid: str) -> Location:
    row = (
        await session.execute(
            select(Location).where(Location.id == parse_uuid(lid, "Location"))
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Location not found")
    return row


@router.get("", response_model=list[LocationOut])
async def list_locations(
    session: AsyncSession = Depends(get_session),
) -> list[LocationOut]:
    rows = (
        await session.execute(
            select(Location).order_by(Location.sort_order.asc(), Location.city.asc())
        )
    ).scalars().all()
    return [await _out(session, loc) for loc in rows]


@router.post("", response_model=LocationOut, status_code=201)
async def create_location(
    payload: LocationCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> LocationOut:
    exists = (
        await session.execute(select(Location.id).where(Location.slug == payload.slug))
    ).first()
    if exists:
        raise ConflictError(f"The slug '{payload.slug}' is already in use")
    loc = Location(
        **payload.model_dump(),
        published_at=utcnow() if payload.status == ContentStatus.PUBLISHED else None,
    )
    session.add(loc)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="location",
        entity_id=str(loc.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return await _out(session, loc)


@router.get("/{lid}", response_model=LocationOut)
async def get_location(
    lid: str, session: AsyncSession = Depends(get_session)
) -> LocationOut:
    return await _out(session, await _load(session, lid))


@router.patch("/{lid}", response_model=LocationOut)
async def update_location(
    lid: str,
    payload: LocationUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> LocationOut:
    loc = await _load(session, lid)
    data = payload.model_dump(exclude_unset=True)
    old_slug = loc.slug

    if "slug" in data and data["slug"] != loc.slug:
        clash = (
            await session.execute(
                select(Location.id).where(
                    Location.slug == data["slug"], Location.id != loc.id
                )
            )
        ).first()
        if clash:
            raise ConflictError(f"The slug '{data['slug']}' is already in use")
        session.add(
            Redirect(
                from_path=f"/locations/{old_slug}",
                to_path=f"/locations/{data['slug']}",
                status_code=301,
            )
        )

    apply_status_timestamp(loc, data)
    for k, v in data.items():
        setattr(loc, k, v)
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="location",
        entity_id=str(loc.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return await _out(session, loc)


@router.put("/{lid}/services", response_model=LocationOut)
async def set_location_services(
    lid: str,
    payload: ServiceAssociationUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> LocationOut:
    """Replace the full set of services offered in this location."""
    loc = await _load(session, lid)

    # Clear existing links, then add the requested ones (validated).
    existing = (
        await session.execute(
            select(ServiceLocation).where(ServiceLocation.location_id == loc.id)
        )
    ).scalars().all()
    for link in existing:
        await session.delete(link)
    await session.flush()

    for sid in dict.fromkeys(payload.service_ids):  # de-duplicate, keep order
        service_uuid = parse_uuid(sid, "Service")
        valid = (
            await session.execute(select(Service.id).where(Service.id == service_uuid))
        ).first()
        if not valid:
            raise NotFoundError(f"Service {sid} not found")
        session.add(ServiceLocation(location_id=loc.id, service_id=service_uuid))
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="location.services",
        entity_id=str(loc.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return await _out(session, loc)


@router.delete("/{lid}", response_model=MessageResponse)
async def delete_location(
    lid: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    loc = await _load(session, lid)
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="location",
        entity_id=str(loc.id),
        ip=client_ip(request),
    )
    await session.delete(loc)
    await session.flush()
    queue_revalidate(bg, TAGS)
    return MessageResponse(message="Location deleted")
