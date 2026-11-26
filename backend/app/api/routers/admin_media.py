"""Admin: the Media Library — upload, list, edit alt text, and safe delete of
PUBLIC marketing images (service/category thumbnails, homepage/banner art).

Each upload is validated (content-type + real Pillow decode + size cap),
re-encoded into optimised WebP display/thumb variants with the original
preserved, recorded as a :class:`MediaAsset`, and stored in the configured
PUBLIC media store (local ``/uploads`` in dev, public Supabase bucket in prod).
Kept entirely separate from the private KYC document store.

Admin-only (router dependency). Deletion is refused while an image is attached
to a PUBLISHED service or category; references from drafts are detached first.
"""

from __future__ import annotations

import re
import secrets
import uuid

from fastapi import APIRouter, Depends, Form, Query, Request, UploadFile
from fastapi import File as FileParam
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.config import settings
from app.core.constants import Audit, ContentStatus
from app.core.errors import APIError, NotFoundError
from app.db.session import get_session
from app.models.category import Category
from app.models.media import MediaAsset
from app.models.service import Service
from app.schemas.media import (
    MediaAssetOut,
    MediaListResponse,
    MediaUpdate,
    MediaUploadResult,
    MediaUsage,
)
from app.services.audit import audit
from app.services.media_storage import (
    ALLOWED_IMAGE_TYPES,
    MediaError,
    get_media_store,
    optimise_image,
)

router = APIRouter(
    prefix="/api/v1/admin/media",
    tags=["admin:media"],
    dependencies=[Depends(require_admin)],
)


def _slug_stem(filename: str | None) -> str:
    stem = re.sub(r"\.[^.]+$", "", filename or "image")
    stem = re.sub(r"[^a-zA-Z0-9]+", "-", stem).strip("-").lower()
    return (stem or "image")[:40]


def _serialize(asset: MediaAsset) -> MediaAssetOut:
    return MediaAssetOut(
        id=str(asset.id),
        url=asset.url,
        thumb_url=asset.thumb_url,
        filename=asset.filename,
        content_type=asset.content_type,
        byte_size=asset.byte_size,
        width=asset.width,
        height=asset.height,
        alt_text=asset.alt_text,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


@router.post("", status_code=201, response_model=MediaUploadResult)
async def upload_image(
    request: Request,
    file: UploadFile = FileParam(...),
    alt: str | None = Form(default=None),
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MediaUploadResult:
    if (file.content_type or "").lower() not in ALLOWED_IMAGE_TYPES:
        raise APIError(
            "Unsupported file type. Upload a JPG, PNG or WebP image.",
            code="unsupported_media",
            status_code=415,
        )
    data = await file.read()
    if len(data) > settings.media_max_upload_bytes:
        mb = settings.media_max_upload_bytes // (1024 * 1024)
        raise APIError(
            f"File too large. Maximum size is {mb} MB.",
            code="payload_too_large",
            status_code=413,
        )

    try:
        opt = optimise_image(data, file.content_type or "")
    except MediaError as exc:
        raise APIError(str(exc), code="invalid_image", status_code=400) from exc

    store = get_media_store()
    token = secrets.token_hex(12)
    stem = _slug_stem(file.filename)
    display_key = f"{token}_{stem}.webp"
    thumb_key = f"thumb/{token}_{stem}.webp"
    original_key = f"orig/{token}_{stem}.{opt.original_ext}"
    try:
        store.save(display_key, opt.display, "image/webp")
        store.save(thumb_key, opt.thumb, "image/webp")
        store.save(original_key, opt.original, file.content_type or "image/jpeg")
    except MediaError as exc:
        raise APIError(
            "Could not store the image. Please try again.",
            code="storage_error",
            status_code=502,
        ) from exc

    base = str(request.base_url)
    asset = MediaAsset(
        storage_backend=(settings.media_storage_backend or "local").lower(),
        storage_key=display_key,
        original_key=original_key,
        thumb_key=thumb_key,
        url=store.public_url(display_key, base),
        thumb_url=store.public_url(thumb_key, base),
        filename=(file.filename or "image")[:200],
        content_type="image/webp",
        byte_size=len(opt.display),
        width=opt.width,
        height=opt.height,
        alt_text=(alt or None),
    )
    session.add(asset)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=str(asset.id),
        ip=client_ip(request),
        meta={"filename": asset.filename, "bytes": len(data)},
    )
    out = _serialize(asset)
    return MediaUploadResult(**out.model_dump(), warnings=opt.warnings)


@router.get("", response_model=MediaListResponse)
async def list_media(
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
) -> MediaListResponse:
    where = []
    if q:
        like = f"%{q.strip()}%"
        where.append(or_(MediaAsset.filename.ilike(like), MediaAsset.alt_text.ilike(like)))
    total = (
        await session.execute(select(func.count()).select_from(MediaAsset).where(*where))
    ).scalar_one()
    rows = (
        await session.execute(
            select(MediaAsset)
            .where(*where)
            .order_by(MediaAsset.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return MediaListResponse(
        items=[_serialize(a) for a in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


async def _load(session: AsyncSession, media_id: str) -> MediaAsset:
    try:
        uid = uuid.UUID(media_id)
    except ValueError:
        raise NotFoundError("Media not found") from None
    asset = (
        await session.execute(select(MediaAsset).where(MediaAsset.id == uid))
    ).scalar_one_or_none()
    if asset is None:
        raise NotFoundError("Media not found")
    return asset


async def _usage(
    session: AsyncSession, media_id: uuid.UUID
) -> tuple[list[Service], list[Category]]:
    services = (
        await session.execute(
            select(Service).where(Service.thumbnail_media_id == media_id)
        )
    ).scalars().all()
    categories = (
        await session.execute(
            select(Category).where(Category.thumbnail_media_id == media_id)
        )
    ).scalars().all()
    return list(services), list(categories)


@router.get("/{media_id}/usage", response_model=MediaUsage)
async def media_usage(
    media_id: str, session: AsyncSession = Depends(get_session)
) -> MediaUsage:
    asset = await _load(session, media_id)
    services, categories = await _usage(session, asset.id)
    return MediaUsage(
        services=[s.title for s in services],
        categories=[c.name for c in categories],
    )


@router.patch("/{media_id}", response_model=MediaAssetOut)
async def update_media(
    media_id: str,
    payload: MediaUpdate,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MediaAssetOut:
    asset = await _load(session, media_id)
    if payload.alt_text is not None:
        asset.alt_text = payload.alt_text or None
    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=str(asset.id),
        ip=client_ip(request),
    )
    return _serialize(asset)


@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    request: Request,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    asset = await _load(session, media_id)
    services, categories = await _usage(session, asset.id)

    # Refuse while attached to anything PUBLISHED (live on the site).
    live = [s for s in services if s.status == ContentStatus.PUBLISHED] + [
        c for c in categories if c.status == ContentStatus.PUBLISHED
    ]
    if live:
        raise APIError(
            "This image is used by a published service or category. "
            "Replace it there before deleting.",
            code="media_in_use",
            status_code=409,
        )

    # Detach from any draft/unpublished references first (engine-independent).
    for s in services:
        s.thumbnail_media_id = None
        s.thumbnail_url = None
        s.thumbnail_alt = None
    for c in categories:
        c.thumbnail_media_id = None
        c.thumbnail_url = None
        c.thumbnail_alt = None

    store = get_media_store()
    for key in (asset.storage_key, asset.thumb_key, asset.original_key):
        if key:
            store.delete(key)
    await session.delete(asset)
    await session.flush()
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=media_id,
        ip=client_ip(request),
    )
    return {"message": "Media deleted"}
