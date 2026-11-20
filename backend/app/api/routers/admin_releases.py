"""Admin CRUD for mobile app releases (the website /download feed source).

Staff-gated (reuses the admin auth dependency) and fully audited. Never fabricates
download links — a release with no build simply has a null download_url.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import parse_uuid
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import Audit
from app.core.errors import NotFoundError
from app.db.session import get_session
from app.models.release import AppRelease
from app.schemas.common import MessageResponse
from app.schemas.release import AppReleaseCreate, AppReleaseOut, AppReleaseUpdate
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/app-releases",
    tags=["admin:releases"],
    dependencies=[Depends(require_admin)],
)


def _out(r: AppRelease) -> AppReleaseOut:
    return AppReleaseOut(
        id=str(r.id),
        app_type=r.app_type,
        platform=r.platform,
        channel=r.channel,
        version=r.version,
        build_number=r.build_number,
        download_url=r.download_url,
        checksum_sha256=r.checksum_sha256,
        release_notes=r.release_notes,
        min_supported_version=r.min_supported_version,
        is_active=r.is_active,
        created_at=r.created_at,
    )


async def _load(session: AsyncSession, rid: str) -> AppRelease:
    row = (
        await session.execute(
            select(AppRelease).where(AppRelease.id == parse_uuid(rid, "Release"))
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Release not found")
    return row


@router.get("", response_model=list[AppReleaseOut])
async def list_releases(
    session: AsyncSession = Depends(get_session),
    app_type: str | None = Query(default=None),
    platform: str | None = Query(default=None),
) -> list[AppReleaseOut]:
    stmt = select(AppRelease)
    if app_type:
        stmt = stmt.where(AppRelease.app_type == app_type)
    if platform:
        stmt = stmt.where(AppRelease.platform == platform)
    stmt = stmt.order_by(AppRelease.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    return [_out(r) for r in rows]


@router.post("", response_model=AppReleaseOut, status_code=201)
async def create_release(
    payload: AppReleaseCreate,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> AppReleaseOut:
    row = AppRelease(**payload.model_dump())
    session.add(row)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="app_release",
        entity_id=str(row.id),
        ip=client_ip(request),
        meta={"app_type": row.app_type, "platform": row.platform, "version": row.version},
    )
    return _out(row)


@router.patch("/{rid}", response_model=AppReleaseOut)
async def update_release(
    rid: str,
    payload: AppReleaseUpdate,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> AppReleaseOut:
    row = await _load(session, rid)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="app_release",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    return _out(row)


@router.delete("/{rid}", response_model=MessageResponse)
async def delete_release(
    rid: str,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    row = await _load(session, rid)
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="app_release",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    await session.delete(row)
    await session.flush()
    return MessageResponse(message="Release deleted")
