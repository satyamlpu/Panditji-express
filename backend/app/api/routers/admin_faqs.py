"""Admin CRUD for FAQs (global or attached to a service)."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import apply_status_timestamp, parse_uuid, queue_revalidate
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import Audit, ContentStatus
from app.core.errors import NotFoundError
from app.db.base import utcnow
from app.db.session import get_session
from app.models.faq import Faq
from app.schemas.admin import FaqCreate, FaqOut, FaqUpdate
from app.schemas.common import MessageResponse
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/faqs",
    tags=["admin:faqs"],
    dependencies=[Depends(require_admin)],
)

TAGS = ["faqs"]


def _out(f: Faq) -> FaqOut:
    return FaqOut(
        id=str(f.id),
        question=f.question,
        answer=f.answer,
        topic=f.topic,
        service_id=str(f.service_id) if f.service_id else None,
        sort_order=f.sort_order,
        status=f.status,
    )


async def _load(session: AsyncSession, fid: str) -> Faq:
    row = (
        await session.execute(select(Faq).where(Faq.id == parse_uuid(fid, "FAQ")))
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("FAQ not found")
    return row


@router.get("", response_model=list[FaqOut])
async def list_faqs(
    session: AsyncSession = Depends(get_session),
    service_id: str | None = Query(default=None),
) -> list[FaqOut]:
    stmt = select(Faq).order_by(Faq.sort_order.asc())
    if service_id == "none":
        stmt = stmt.where(Faq.service_id.is_(None))
    elif service_id:
        stmt = stmt.where(Faq.service_id == parse_uuid(service_id, "Service"))
    rows = (await session.execute(stmt)).scalars().all()
    return [_out(f) for f in rows]


@router.post("", response_model=FaqOut, status_code=201)
async def create_faq(
    payload: FaqCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> FaqOut:
    data = payload.model_dump()
    sid = data.pop("service_id")
    row = Faq(
        **data,
        service_id=parse_uuid(sid, "Service") if sid else None,
        published_at=utcnow() if payload.status == ContentStatus.PUBLISHED else None,
    )
    session.add(row)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="faq",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return _out(row)


@router.patch("/{fid}", response_model=FaqOut)
async def update_faq(
    fid: str,
    payload: FaqUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> FaqOut:
    row = await _load(session, fid)
    data = payload.model_dump(exclude_unset=True)
    apply_status_timestamp(row, data)
    if "service_id" in data:
        sid = data.pop("service_id")
        row.service_id = parse_uuid(sid, "Service") if sid else None
    for k, v in data.items():
        setattr(row, k, v)
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="faq",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return _out(row)


@router.delete("/{fid}", response_model=MessageResponse)
async def delete_faq(
    fid: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    row = await _load(session, fid)
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="faq",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    await session.delete(row)
    await session.flush()
    queue_revalidate(bg, TAGS)
    return MessageResponse(message="FAQ deleted")
