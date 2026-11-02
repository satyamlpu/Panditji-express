"""Admin: view and manage booking enquiries."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.api.serializers import enquiry_out
from app.core.constants import Audit
from app.core.errors import NotFoundError
from app.db.session import get_session
from app.models.enquiry import BookingEnquiry
from app.schemas.common import Page
from app.schemas.enquiry import EnquiryOut, EnquiryUpdate
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/enquiries",
    tags=["admin:enquiries"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=Page[EnquiryOut])
async def list_enquiries(
    session: AsyncSession = Depends(get_session),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[EnquiryOut]:
    stmt = select(BookingEnquiry)
    if status:
        stmt = stmt.where(BookingEnquiry.status == status)
    total = (
        await session.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    stmt = (
        stmt.order_by(BookingEnquiry.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return Page[EnquiryOut](
        items=[enquiry_out(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{enquiry_id}", response_model=EnquiryOut)
async def update_enquiry(
    enquiry_id: str,
    payload: EnquiryUpdate,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> EnquiryOut:
    try:
        eid = uuid.UUID(enquiry_id)
    except ValueError:
        raise NotFoundError("Enquiry not found") from None
    row = (
        await session.execute(select(BookingEnquiry).where(BookingEnquiry.id == eid))
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Enquiry not found")

    data = payload.model_dump(exclude_unset=True)
    for field in ("status", "admin_notes"):
        if field in data:
            setattr(row, field, data[field])
    await session.flush()
    await audit(
        session,
        action=Audit.ENQUIRY_UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="enquiry",
        entity_id=str(row.id),
        ip=client_ip(request),
        meta={"status": row.status},
    )
    return enquiry_out(row)
