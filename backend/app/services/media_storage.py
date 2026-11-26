"""Public marketing-image storage + optimisation (the Media Library backend).

Responsibilities:

* Validate that an upload really is an allowed raster image (content-type *and*
  a successful Pillow decode — a renamed script never survives the re-encode).
* Preserve the ORIGINAL bytes, and derive two optimised WebP variants: a
  ``display`` image (capped width, good for hero/detail) and a ``thumb`` (for
  grids and mobile cards). This is the "store the original safely + generate
  optimised display versions" requirement.
* Persist the three objects to the configured PUBLIC store — local disk
  (served via the ``/uploads`` mount) in dev, or a PUBLIC Supabase bucket in
  production — kept entirely separate from the private KYC store.

Every object key is generated server-side (``secrets`` + extension); the client
filename is never used to build a path, so a crafted name cannot escape the
store root or collide.
"""

from __future__ import annotations

import contextlib
import io
import secrets
from pathlib import Path

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

# Accepted upload content types → canonical extension. JPG/JPEG/PNG/WebP only
# (SVG is excluded: it can carry script). This is the marketing-image allowlist.
ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# Optimised-variant geometry.
DISPLAY_MAX_WIDTH = 1600
THUMB_WIDTH = 480
# Recommended minimums (16:9, 1280×720). Enforced as a WARNING, not a hard
# reject, so an editor is never blocked — the API surfaces the advisory.
RECOMMENDED_MIN_WIDTH = 1280
RECOMMENDED_MIN_HEIGHT = 720


class MediaError(RuntimeError):
    """Raised when an upload is invalid or the store cannot complete an op."""


class OptimisedImage:
    """Result of decoding + optimising an upload (bytes still in memory)."""

    def __init__(
        self,
        *,
        original: bytes,
        original_ext: str,
        display: bytes,
        thumb: bytes,
        width: int,
        height: int,
        warnings: list[str],
    ) -> None:
        self.original = original
        self.original_ext = original_ext
        self.display = display
        self.thumb = thumb
        self.width = width
        self.height = height
        self.warnings = warnings


def optimise_image(data: bytes, content_type: str) -> OptimisedImage:
    """Decode, sanity-check and re-encode an upload into display + thumb WebP.

    Raises :class:`MediaError` if the bytes are not a decodable allowed image.
    """
    ext = ALLOWED_IMAGE_TYPES.get((content_type or "").lower())
    if ext is None:
        raise MediaError(
            "Unsupported file type. Upload a JPG, PNG or WebP image."
        )
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()  # cheap structural check; must reopen to use afterwards
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # bake in rotation, drop EXIF
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise MediaError("That file is not a valid image.") from exc

    width, height = img.size
    warnings: list[str] = []
    if width < RECOMMENDED_MIN_WIDTH or height < RECOMMENDED_MIN_HEIGHT:
        warnings.append(
            f"Image is {width}×{height}px. For best results use at least "
            f"{RECOMMENDED_MIN_WIDTH}×{RECOMMENDED_MIN_HEIGHT}px (16:9)."
        )

    rgb = img.convert("RGB")

    def _encode(src: Image.Image, max_w: int) -> bytes:
        im = src
        if im.width > max_w:
            ratio = max_w / float(im.width)
            im = im.resize((max_w, max(1, round(im.height * ratio))), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=82, method=6)
        return buf.getvalue()

    display = _encode(rgb, DISPLAY_MAX_WIDTH)
    thumb = _encode(rgb, THUMB_WIDTH)
    return OptimisedImage(
        original=data,
        original_ext=ext,
        display=display,
        thumb=thumb,
        width=width,
        height=height,
        warnings=warnings,
    )


# ── Stores ───────────────────────────────────────────────────────────────────


class LocalPublicStore:
    """Writes objects under a public dir served by the ``/uploads`` mount."""

    #: URL path prefix the StaticFiles mount serves ``base_dir`` from.
    url_prefix = "/uploads/media"

    def __init__(self, base_dir: str) -> None:
        self._base = Path(base_dir).resolve()

    def _path(self, key: str) -> Path:
        path = (self._base / key).resolve()
        if not str(path).startswith(str(self._base) + "/"):
            raise MediaError("Refusing to write outside the media root")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def delete(self, key: str) -> None:
        with contextlib.suppress(OSError):
            self._path(key).unlink(missing_ok=True)

    def public_url(self, key: str, request_base: str | None) -> str:
        if settings.media_public_base_url:
            root = settings.media_public_base_url.rstrip("/")
            return f"{root}/{key}"
        base = (request_base or settings.site_url or "").rstrip("/")
        return f"{base}{self.url_prefix}/{key}"


class SupabasePublicStore:
    """Stores objects in a PUBLIC Supabase Storage bucket (prod-safe/durable)."""

    def __init__(self, base_url: str, service_key: str, bucket: str) -> None:
        if not (base_url and service_key and bucket):
            raise MediaError(
                "Supabase media storage is not configured: set SUPABASE_URL, "
                "SUPABASE_SERVICE_KEY and SUPABASE_MEDIA_BUCKET."
            )
        self._root = base_url.rstrip("/")
        self._key = service_key
        self._bucket = bucket

    def _object_url(self, key: str) -> str:
        return f"{self._root}/storage/v1/object/{self._bucket}/{key}"

    def save(self, key: str, data: bytes, content_type: str) -> None:
        resp = httpx.post(
            self._object_url(key),
            content=data,
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": content_type,
                "x-upsert": "true",
                "cache-control": "public, max-age=31536000, immutable",
            },
            timeout=30.0,
        )
        if resp.status_code >= 400:
            raise MediaError(f"Supabase upload failed ({resp.status_code})")

    def delete(self, key: str) -> None:
        with contextlib.suppress(httpx.HTTPError):
            httpx.request(
                "DELETE",
                self._object_url(key),
                headers={"Authorization": f"Bearer {self._key}"},
                timeout=30.0,
            )

    def public_url(self, key: str, request_base: str | None) -> str:
        if settings.media_public_base_url:
            root = settings.media_public_base_url.rstrip("/")
            return f"{root}/{key}"
        return f"{self._root}/storage/v1/object/public/{self._bucket}/{key}"


def get_media_store() -> LocalPublicStore | SupabasePublicStore:
    backend = (settings.media_storage_backend or "local").lower()
    if backend == "supabase":
        return SupabasePublicStore(
            settings.supabase_url,
            settings.supabase_service_key,
            settings.supabase_media_bucket,
        )
    return LocalPublicStore(settings.media_local_dir)


def new_object_key(stem: str, ext: str) -> str:
    """A collision-free, path-safe object key (server-controlled only)."""
    return f"{secrets.token_hex(12)}_{stem}.{ext}"
