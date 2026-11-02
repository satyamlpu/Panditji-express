"""Admin CRUD for editable pages (about, contact, policies)."""

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
from app.models.page import Page
from app.schemas.admin import PageCreate, PageOut, PageUpdate
from app.schemas.common import MessageResponse
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/pages",
    tags=["admin:pages"],
    dependencies=[Depends(require_admin)],
)


def _out(p: Page) -> PageOut:
    return PageOut(
        id=str(p.id),
        slug=p.slug,
        title=p.title,
        body=p.body,
        status=p.status,
        seo_title=p.seo_title,
        seo_description=p.seo_description,
        updated_at=p.updated_at,
    )


async def _load(session: AsyncSession, pid: str) -> Page:
    row = (
        await session.execute(select(Page).where(Page.id == parse_uuid(pid, "Page")))
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Page not found")
    return row


@router.get("", response_model=list[PageOut])
async def list_pages(session: AsyncSession = Depends(get_session)) -> list[PageOut]:
    rows = (
        await session.execute(select(Page).order_by(Page.title.asc()))
    ).scalars().all()
    return [_out(p) for p in rows]


@router.post("", response_model=PageOut, status_code=201)
async def create_page(
    payload: PageCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> PageOut:
    exists = (
        await session.execute(select(Page.id).where(Page.slug == payload.slug))
    ).first()
    if exists:
        raise ConflictError(f"The slug '{payload.slug}' is already in use")
    row = Page(
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
        entity="page",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, ["pages", f"page:{row.slug}"])
    return _out(row)


@router.get("/{pid}", response_model=PageOut)
async def get_page(pid: str, session: AsyncSession = Depends(get_session)) -> PageOut:
    return _out(await _load(session, pid))


@router.patch("/{pid}", response_model=PageOut)
async def update_page(
    pid: str,
    payload: PageUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> PageOut:
    row = await _load(session, pid)
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
        entity="page",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, ["pages", f"page:{row.slug}"])
    return _out(row)


@router.delete("/{pid}", response_model=MessageResponse)
async def delete_page(
    pid: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    row = await _load(session, pid)
    slug = row.slug
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="page",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    await session.delete(row)
    await session.flush()
    queue_revalidate(bg, ["pages", f"page:{slug}"])
    return MessageResponse(message="Page deleted")
