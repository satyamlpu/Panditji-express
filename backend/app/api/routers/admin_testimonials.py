"""Admin CRUD for testimonials."""

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
from app.models.testimonial import Testimonial
from app.schemas.admin import TestimonialCreate, TestimonialOut, TestimonialUpdate
from app.schemas.common import MessageResponse
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/testimonials",
    tags=["admin:testimonials"],
    dependencies=[Depends(require_admin)],
)

TAGS = ["testimonials"]


def _out(t: Testimonial) -> TestimonialOut:
    return TestimonialOut(
        id=str(t.id),
        author_name=t.author_name,
        author_location=t.author_location,
        service_label=t.service_label,
        quote=t.quote,
        rating=t.rating,
        sort_order=t.sort_order,
        status=t.status,
        created_at=t.created_at,
    )


async def _load(session: AsyncSession, tid: str) -> Testimonial:
    row = (
        await session.execute(
            select(Testimonial).where(Testimonial.id == parse_uuid(tid, "Testimonial"))
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Testimonial not found")
    return row


@router.get("", response_model=list[TestimonialOut])
async def list_testimonials(
    session: AsyncSession = Depends(get_session),
) -> list[TestimonialOut]:
    rows = (
        await session.execute(
            select(Testimonial).order_by(
                Testimonial.sort_order.asc(), Testimonial.created_at.desc()
            )
        )
    ).scalars().all()
    return [_out(t) for t in rows]


@router.post("", response_model=TestimonialOut, status_code=201)
async def create_testimonial(
    payload: TestimonialCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> TestimonialOut:
    row = Testimonial(
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
        entity="testimonial",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return _out(row)


@router.patch("/{tid}", response_model=TestimonialOut)
async def update_testimonial(
    tid: str,
    payload: TestimonialUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> TestimonialOut:
    row = await _load(session, tid)
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
        entity="testimonial",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    queue_revalidate(bg, TAGS)
    return _out(row)


@router.delete("/{tid}", response_model=MessageResponse)
async def delete_testimonial(
    tid: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    row = await _load(session, tid)
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="testimonial",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    await session.delete(row)
    await session.flush()
    queue_revalidate(bg, TAGS)
    return MessageResponse(message="Testimonial deleted")
