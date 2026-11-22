"""Admin Media Library: centralized website image uploads.

Images are stored in object storage (a local dir in dev, a Supabase bucket in
prod) under a server-generated key, recorded as ``MediaAsset`` rows, and served
read-only through a cache-friendly **public proxy** (``/api/v1/public/media/
{id}``) so they survive ephemeral/serverless filesystems and can sit behind a
CDN later. Raster images only (PNG/JPEG/WEBP/GIF); SVG is rejected (it can carry
script). Deletion is blocked while an image is still referenced by site content.

The ``POST`` here is the same endpoint the inline image pickers on content pages
call; it still returns ``{url, path, ...}`` so those keep working unchanged.
"""

from __future__ import annotations

import contextlib
import json

from fastapi import APIRouter, Depends, Query, Request, UploadFile
from fastapi import File as FileParam
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin_util import parse_uuid
from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.config import settings
from app.core.constants import Audit
from app.core.errors import APIError, NotFoundError
from app.db.session import get_session
from app.marketplace.storage import (
    MEDIA_CONTENT_TYPES,
    StorageError,
    build_media_key,
    get_media_storage,
)
from app.models.banner import HomepageSection
from app.models.media import MediaAsset
from app.models.setting import Setting
from app.schemas.common import MessageResponse
from app.schemas.media import MediaAltUpdate, MediaAssetOut
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/media",
    tags=["admin:media"],
    dependencies=[Depends(require_admin)],
)


def _public_path(media_id: str) -> str:
    return f"/api/v1/public/media/{media_id}"


def _out(row: MediaAsset, request: Request) -> MediaAssetOut:
    path = _public_path(str(row.id))
    return MediaAssetOut(
        id=str(row.id),
        path=path,
        url=str(request.base_url).rstrip("/") + path,
        filename=row.filename,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        alt_text=row.alt_text,
        created_at=row.created_at,
    )


async def _load(session: AsyncSession, mid: str) -> MediaAsset:
    row = (
        await session.execute(
            select(MediaAsset).where(MediaAsset.id == parse_uuid(mid, "Media"))
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Media not found")
    return row


def _safe_filename(name: str | None) -> str:
    """Keep only a display-safe basename; never used to build a storage path."""
    base = (name or "image").replace("\\", "/").rsplit("/", 1)[-1].strip()
    return (base or "image")[:200]


@router.get("", response_model=list[MediaAssetOut])
async def list_media(
    request: Request,
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(default=None, description="Search filename / alt text"),
) -> list[MediaAssetOut]:
    stmt = select(MediaAsset)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(MediaAsset.filename.ilike(like), MediaAsset.alt_text.ilike(like))
        )
    stmt = stmt.order_by(MediaAsset.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    return [_out(r, request) for r in rows]


@router.post("", status_code=201)
async def upload_image(
    request: Request,
    file: UploadFile = FileParam(...),
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    content_type = (file.content_type or "").lower()
    ext = MEDIA_CONTENT_TYPES.get(content_type)
    if ext is None:
        raise APIError(
            "Unsupported file type. Upload a PNG, JPEG, WEBP or GIF image.",
            code="unsupported_media",
            status_code=415,
        )

    data = await file.read()
    if not data:
        raise APIError("Empty file.", code="empty_file", status_code=400)
    if len(data) > settings.media_max_upload_bytes:
        mb = settings.media_max_upload_bytes // (1024 * 1024)
        raise APIError(
            f"File too large. Maximum size is {mb} MB.",
            code="payload_too_large",
            status_code=413,
        )

    key = build_media_key(ext)
    try:
        stored_key = await get_media_storage().save(key, data, content_type)
    except StorageError:
        raise APIError(
            "Could not store the image. Please try again.",
            code="storage_error",
            status_code=502,
        ) from None

    row = MediaAsset(
        filename=_safe_filename(file.filename),
        content_type=content_type,
        size_bytes=len(data),
        storage_key=stored_key,
        uploaded_by=admin.email,
    )
    session.add(row)
    await session.flush()

    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=str(row.id),
        ip=client_ip(request),
        meta={"filename": row.filename, "size_bytes": row.size_bytes},
    )

    out = _out(row, request)
    # Superset of the legacy {path, url} contract the inline pickers rely on.
    return {
        "id": out.id,
        "url": out.url,
        "path": out.path,
        "filename": out.filename,
        "content_type": out.content_type,
        "size_bytes": out.size_bytes,
        "alt_text": out.alt_text,
        "created_at": out.created_at.isoformat(),
    }


@router.patch("/{mid}", response_model=MediaAssetOut)
async def update_alt(
    mid: str,
    payload: MediaAltUpdate,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MediaAssetOut:
    row = await _load(session, mid)
    row.alt_text = (payload.alt_text or "").strip() or None
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    return _out(row, request)


async def _usage(session: AsyncSession, media_id: str) -> list[str]:
    """Where, if anywhere, the image's public path is still referenced.

    Matches on the stable ``/api/v1/public/media/{id}`` path (host-independent),
    which is a substring of whatever absolute URL was stored. Covers homepage
    section images and any site setting (logo, default OG image, …) that embeds
    the image. Best-effort, deliberately conservative: a hit blocks deletion.
    """
    path = _public_path(media_id)
    used: list[str] = []

    sections = (
        await session.execute(
            select(HomepageSection.heading, HomepageSection.image_url).where(
                HomepageSection.image_url.ilike(f"%{path}%")
            )
        )
    ).all()
    for heading, _ in sections:
        used.append(f"Homepage section: {heading or 'untitled'}")

    settings_rows = (await session.execute(select(Setting))).scalars().all()
    for s in settings_rows:
        try:
            blob = json.dumps(s.value)
        except (TypeError, ValueError):
            blob = str(s.value)
        if path in blob:
            used.append(f"Setting: {s.key}")

    return used


@router.delete("/{mid}", response_model=MessageResponse)
async def delete_media(
    mid: str,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    row = await _load(session, mid)

    used = await _usage(session, str(row.id))
    if used:
        raise APIError(
            "This image is still in use and cannot be deleted. Remove it from: "
            + "; ".join(used),
            code="media_in_use",
            status_code=409,
        )

    # Remove the bytes best-effort; a missing object must not block the row
    # delete (storage and DB can drift on a serverless/ephemeral filesystem).
    with contextlib.suppress(StorageError):
        await get_media_storage().delete(row.storage_key)

    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=str(row.id),
        ip=client_ip(request),
    )
    await session.delete(row)
    await session.flush()
    return MessageResponse(message="Image deleted")
