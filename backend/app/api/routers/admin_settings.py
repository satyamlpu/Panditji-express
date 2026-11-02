"""Admin: read and update site-wide settings (nav, footer, contact, SEO, social)."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import queue_revalidate
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import Audit
from app.db.session import get_session
from app.models.setting import Setting
from app.schemas.admin import SettingUpdate
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/settings",
    tags=["admin:settings"],
    dependencies=[Depends(require_admin)],
)


@router.get("")
async def list_settings(session: AsyncSession = Depends(get_session)) -> dict:
    rows = (await session.execute(select(Setting))).scalars().all()
    return {row.key: row.value for row in rows}


@router.put("/{key}")
async def upsert_setting(
    key: str,
    payload: SettingUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = (
        await session.execute(select(Setting).where(Setting.key == key))
    ).scalar_one_or_none()
    if row is None:
        row = Setting(key=key, value=payload.value)
        session.add(row)
    else:
        row.value = payload.value
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="setting",
        entity_id=key,
        ip=client_ip(request),
    )
    # Settings drive the site chrome everywhere — revalidate broadly.
    queue_revalidate(bg, ["settings", "catalog", "homepage"])
    return {key: row.value}
