"""Private storage for KYC verification documents.

KYC files (ID scans, photos) are **private**: they are never served from a
public URL. The partner app uploads bytes to the backend; staff retrieve them
only through an authenticated, audited admin endpoint that streams the bytes
back through this process. No signed public URL is ever handed to a browser.

Two backends, selected by ``settings.storage_backend``:

* ``local``  — writes under a private directory on the server filesystem
  (default ``uploads/kyc``, git-ignored). Correct for dev and single-host
  deployments. On ephemeral/serverless filesystems (e.g. Vercel) files written
  here do not survive, so production should use ``supabase``.
* ``supabase`` — stores objects in a **private** Supabase Storage bucket via its
  REST API using the service-role key (server-only). Reads download the bytes
  back through this process, so the object stays private end to end.

The storage *key* is always generated server-side from ids we control
(``{pandit_id}/{doc_id}/{uuid}.{ext}``); the client's filename is never trusted
to build a path.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import httpx

from app.core.config import settings

# Accepted document MIME types and their canonical extension. A short allowlist
# keeps uploads to things a human reviewer can actually open and blocks
# executable/HTML payloads.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


class StorageError(RuntimeError):
    """Raised when the configured storage backend cannot complete an operation."""


def build_key(pandit_id: str, doc_id: str, ext: str) -> str:
    """A collision-free, path-safe object key under the owning partner + doc.

    Every component is a value the server controls (uuids and an extension from
    the content-type allowlist), so the key cannot be steered by the client.
    """
    safe_ext = ext if ext in ALLOWED_CONTENT_TYPES.values() else "bin"
    return f"{pandit_id}/{doc_id}/{uuid.uuid4().hex}.{safe_ext}"


class LocalDiskStorage:
    """Stores objects under a private base directory on the local filesystem."""

    def __init__(self, base_dir: str) -> None:
        self._base = Path(base_dir).resolve()

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        path = (self._base / key).resolve()
        # Defence in depth: the key is server-generated, but never let a crafted
        # key escape the base directory.
        if not str(path).startswith(str(self._base) + "/"):
            raise StorageError("Refusing to write outside the storage root")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    async def fetch(self, ref: str) -> bytes:
        path = (self._base / ref).resolve()
        if not str(path).startswith(str(self._base) + "/"):
            raise StorageError("Refusing to read outside the storage root")
        if not path.is_file():
            raise StorageError("Stored file not found")
        return path.read_bytes()


class SupabaseStorage:
    """Stores objects in a private Supabase Storage bucket via its REST API.

    Uses the service-role key, which must stay server-side. The bucket is
    expected to be **private**; reads proxy the bytes through the backend rather
    than exposing a public or signed URL.
    """

    def __init__(self, base_url: str, service_key: str, bucket: str) -> None:
        if not (base_url and service_key and bucket):
            raise StorageError(
                "Supabase storage is not configured: set SUPABASE_URL, "
                "SUPABASE_SERVICE_KEY and SUPABASE_STORAGE_BUCKET."
            )
        self._root = base_url.rstrip("/")
        self._key = service_key
        self._bucket = bucket

    def _object_url(self, ref: str) -> str:
        return f"{self._root}/storage/v1/object/{self._bucket}/{ref}"

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._key}"}

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(
                self._object_url(key),
                content=data,
                headers={
                    **self._headers,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
        if resp.status_code >= 400:
            raise StorageError(f"Supabase upload failed ({resp.status_code})")
        return key

    async def fetch(self, ref: str) -> bytes:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.get(self._object_url(ref), headers=self._headers)
        if resp.status_code == 404:
            raise StorageError("Stored file not found")
        if resp.status_code >= 400:
            raise StorageError(f"Supabase download failed ({resp.status_code})")
        return resp.content


def get_storage() -> LocalDiskStorage | SupabaseStorage:
    """Build the storage backend named by settings (cheap; no shared state)."""
    backend = (settings.storage_backend or "local").lower()
    if backend == "supabase":
        return SupabaseStorage(
            settings.supabase_url,
            settings.supabase_service_key,
            settings.supabase_storage_bucket,
        )
    return LocalDiskStorage(settings.storage_local_dir)
