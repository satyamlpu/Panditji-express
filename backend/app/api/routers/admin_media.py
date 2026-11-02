"""Admin: restricted image uploads.

Only raster images, size-capped, written with a random name to the uploads
directory and served read-only at /uploads/<name>. SVG is rejected (it can carry
script). Images are optional — the site works without any.
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, Request, UploadFile
from fastapi import File as FileParam
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.core.constants import Audit
from app.core.errors import APIError
from app.db.session import get_session
from app.services.audit import audit

router = APIRouter(
    prefix="/api/v1/admin/media",
    tags=["admin:media"],
    dependencies=[Depends(require_admin)],
)

UPLOAD_DIR = Path("uploads")
MAX_BYTES = 3 * 1024 * 1024  # 3 MB
# Allowed content types → file extension. SVG deliberately excluded.
ALLOWED = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


@router.post("", status_code=201)
async def upload_image(
    request: Request,
    file: UploadFile = FileParam(...),
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    ext = ALLOWED.get(file.content_type or "")
    if ext is None:
        raise APIError(
            "Unsupported file type. Upload a PNG, JPEG, WEBP or GIF image.",
            code="unsupported_media",
            status_code=415,
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise APIError(
            "File too large. Maximum size is 3 MB.",
            code="payload_too_large",
            status_code=413,
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(16)}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)

    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="media",
        entity_id=name,
        ip=client_ip(request),
    )

    path = f"/uploads/{name}"
    url = str(request.base_url).rstrip("/") + path
    return {"path": path, "url": url}
