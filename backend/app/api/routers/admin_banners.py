"""Admin CRUD for homepage sections / promotional banners."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import apply_status_timestamp, parse_uuid, queue_revalidate
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import Audit, ContentStatus
from app.core.errors import NotFoundError
from app.db.base import utcnow
from app.db.session import get_session
from app.models.banner import HomepageSection
from app.schemas.admin import BannerCreate, BannerOut, BannerUpdate
from app.schemas.common import MessageResponse
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/homepage-sections",
    tags=["admin:homepage"],
    dependencies=[Depends(require_admin)],
)

TAGS = ["homepage"]


def _out(b: HomepageSection) -> BannerOut:
    return BannerOut(
        id=str(b.id),
        kind=b.kind,
        heading=b.heading,
        subheading=b.subheading,
        body=b.body,
        cta_label=b.cta_label,
        cta_href=b.cta_href,
        image_url=b.image_url,
        sort_order=b.sort_order,
        status=b.status,
    )


async def _load(session: AsyncSession, bid: str) -> HomepageSection:
    row = (
        await session.execute(
            select(HomepageSection).where(HomepageSection.id == parse_uuid(bid, "Section"))
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Section not found")
    return row


@router.get("", response_model=list[BannerOut])
async def list_sections(
    session: AsyncSession = Depends(get_session),
) -> list[BannerOut]:
    rows = (
        await session.execute(
            select(HomepageSection).order_by(HomepageSection.sort_order.asc())
        )
    ).scalars().all()
    return [_out(b) for b in rows]


@router.post("", response_model=BannerOut, status_code=201)
async def create_section(
    payload: BannerCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> BannerOut:
    row = HomepageSection(
        **payload.model_dump(),
        published_at=utcnow() if payload.status == ContentStatus.PUBLISHED else None,
    )
    session.add(row)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="homepage_section",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return _out(row)


@router.patch("/{bid}", response_model=BannerOut)
async def update_section(
    bid: str,
    payload: BannerUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> BannerOut:
    row = await _load(session, bid)
    data = payload.model_dump(exclude_unset=True)
    apply_status_timestamp(row, data)
    for k, v in data.items():
        setattr(row, k, v)
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="homepage_section",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return _out(row)


@router.delete("/{bid}", response_model=MessageResponse)
async def delete_section(
    bid: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    row = await _load(session, bid)
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="homepage_section",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    await session.delete(row)
    await session.flush()
    queue_revalidate(bg, TAGS)
    return MessageResponse(message="Section deleted")
