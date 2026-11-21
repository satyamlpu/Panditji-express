"""Staff & role management — super-admin only, audited.

Roles are enforced server-side everywhere (see require_staff / require_admin);
this is the UI/API to view staff and assign roles. Lockout guards prevent the
super-admin from removing their own access or deleting the last active admin.
Account creation (with password handling) is intentionally out of scope here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import parse_uuid
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import AdminStatus, Audit, Role
from app.core.errors import APIError, NotFoundError
from app.db.session import get_session
from app.models.admin_user import AdminUser
from app.schemas.staff import StaffOut, StaffUpdate
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/staff",
    tags=["admin:staff"],
    dependencies=[Depends(require_admin)],
)


def _out(u: AdminUser) -> StaffOut:
    return StaffOut(
        id=str(u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        status=u.status,
        created_at=u.created_at,
    )


async def _active_admin_count(session: AsyncSession) -> int:
    return (
        await session.execute(
            select(func.count())
            .select_from(AdminUser)
            .where(AdminUser.role == Role.ADMIN, AdminUser.status == AdminStatus.ACTIVE)
        )
    ).scalar_one()


@router.get("", response_model=list[StaffOut])
async def list_staff(
    session: AsyncSession = Depends(get_session),
) -> list[StaffOut]:
    rows = (
        await session.execute(select(AdminUser).order_by(AdminUser.created_at.asc()))
    ).scalars().all()
    return [_out(u) for u in rows]


@router.patch("/{sid}", response_model=StaffOut)
async def update_staff(
    sid: str,
    payload: StaffUpdate,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> StaffOut:
    target = (
        await session.execute(
            select(AdminUser).where(AdminUser.id == parse_uuid(sid, "Staff"))
        )
    ).scalar_one_or_none()
    if target is None:
        raise NotFoundError("Staff member not found")

    new_role = payload.role if payload.role is not None else target.role
    new_status = payload.status if payload.status is not None else target.status

    editing_self = str(target.id) == admin.id
    was_active_admin = target.role == Role.ADMIN and target.status == AdminStatus.ACTIVE
    loses_admin = was_active_admin and (
        new_role != Role.ADMIN or new_status != AdminStatus.ACTIVE
    )

    # Never let the super-admin lock themselves out.
    if editing_self and loses_admin:
        raise APIError(
            "You cannot remove your own super-admin access.",
            code="not_allowed",
            status_code=409,
        )
    # Keep at least one active super-admin at all times.
    if loses_admin and await _active_admin_count(session) <= 1:
        raise APIError(
            "At least one active super-admin must remain.",
            code="not_allowed",
            status_code=409,
        )

    target.role = new_role
    target.status = new_status
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="admin_user",
        entity_id=str(target.id),
        ip=client_ip(request),
        meta={"role": new_role, "status": new_status},
    )
    return _out(target)
