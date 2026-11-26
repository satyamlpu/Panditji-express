"""Media Library + service/category thumbnail + sync-status + revisions tests."""

from __future__ import annotations

import io

import pytest
from httpx import AsyncClient
from PIL import Image

pytestmark = pytest.mark.asyncio


def _png(width: int = 1280, height: int = 720, colour=(154, 28, 36)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buf, format="PNG")
    return buf.getvalue()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _upload(client: AsyncClient, token: str, *, width=1280, height=720, alt=None):
    files = {"file": ("thumb.png", _png(width, height), "image/png")}
    data = {"alt": alt} if alt else None
    return await client.post(
        "/api/v1/admin/media", headers=_auth(token), files=files, data=data
    )


async def test_upload_optimises_to_webp(client: AsyncClient, admin_token: str):
    res = await _upload(client, admin_token, alt="Ganesh puja setup")
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["content_type"] == "image/webp"
    assert body["url"].endswith(".webp")
    assert body["thumb_url"]
    assert body["width"] == 1280 and body["height"] == 720
    assert body["alt_text"] == "Ganesh puja setup"
    assert body["warnings"] == []  # meets the 1280x720 recommendation


async def test_small_image_warns_but_succeeds(client: AsyncClient, admin_token: str):
    res = await _upload(client, admin_token, width=640, height=360)
    assert res.status_code == 201, res.text
    assert res.json()["warnings"], "a sub-recommendation image should warn"


async def test_reject_non_image(client: AsyncClient, admin_token: str):
    files = {"file": ("x.png", b"not really a png", "image/png")}
    res = await client.post("/api/v1/admin/media", headers=_auth(admin_token), files=files)
    assert res.status_code == 400


async def test_reject_unsupported_type(client: AsyncClient, admin_token: str):
    files = {"file": ("x.svg", b"<svg/>", "image/svg+xml")}
    res = await client.post("/api/v1/admin/media", headers=_auth(admin_token), files=files)
    assert res.status_code == 415


async def test_list_and_patch_alt(client: AsyncClient, admin_token: str):
    up = await _upload(client, admin_token)
    mid = up.json()["id"]
    lst = await client.get("/api/v1/admin/media", headers=_auth(admin_token))
    assert lst.status_code == 200
    assert lst.json()["total"] >= 1
    patched = await client.patch(
        f"/api/v1/admin/media/{mid}",
        headers=_auth(admin_token),
        json={"alt_text": "New alt"},
    )
    assert patched.status_code == 200
    assert patched.json()["alt_text"] == "New alt"


async def test_service_thumbnail_roundtrip_and_public(client: AsyncClient, admin_token: str):
    mid = (await _upload(client, admin_token, alt="Puja thali")).json()["id"]
    # Attach to a new published service.
    created = await client.post(
        "/api/v1/admin/services",
        headers=_auth(admin_token),
        json={
            "slug": "thumb-puja",
            "title": "Thumbnail Puja",
            "title_hi": "थंबनेल पूजा",
            "status": "published",
            "thumbnail_media_id": mid,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["thumbnail"]["url"].endswith(".webp")
    assert body["thumbnail"]["alt"] == "Puja thali"
    assert body["title_hi"] == "थंबनेल पूजा"

    # Public catalog exposes the thumbnail.
    pub = await client.get("/api/v1/public/services")
    assert pub.status_code == 200
    item = next(s for s in pub.json() if s["slug"] == "thumb-puja")
    assert item["thumbnail"]["url"].endswith(".webp")
    assert item["title_hi"] == "थंबनेल पूजा"


async def test_cannot_delete_media_used_by_published(client: AsyncClient, admin_token: str):
    mid = (await _upload(client, admin_token)).json()["id"]
    await client.post(
        "/api/v1/admin/services",
        headers=_auth(admin_token),
        json={
            "slug": "guarded-puja",
            "title": "Guarded Puja",
            "status": "published",
            "thumbnail_media_id": mid,
        },
    )
    res = await client.delete(f"/api/v1/admin/media/{mid}", headers=_auth(admin_token))
    assert res.status_code == 409, res.text
    usage = await client.get(
        f"/api/v1/admin/media/{mid}/usage", headers=_auth(admin_token)
    )
    assert "Guarded Puja" in usage.json()["services"]


async def test_clear_thumbnail(client: AsyncClient, admin_token: str):
    mid = (await _upload(client, admin_token)).json()["id"]
    created = await client.post(
        "/api/v1/admin/services",
        headers=_auth(admin_token),
        json={"slug": "clearable", "title": "Clearable", "thumbnail_media_id": mid},
    )
    sid = created.json()["id"]
    cleared = await client.patch(
        f"/api/v1/admin/services/{sid}",
        headers=_auth(admin_token),
        json={"thumbnail_media_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["thumbnail"] is None


async def test_revisions_recorded(client: AsyncClient, admin_token: str):
    created = await client.post(
        "/api/v1/admin/services",
        headers=_auth(admin_token),
        json={"slug": "rev-puja", "title": "Rev Puja", "status": "draft"},
    )
    sid = created.json()["id"]
    await client.patch(
        f"/api/v1/admin/services/{sid}",
        headers=_auth(admin_token),
        json={"status": "published"},
    )
    revs = await client.get(
        "/api/v1/admin/revisions",
        headers=_auth(admin_token),
        params={"entity_type": "service", "entity_id": sid},
    )
    assert revs.status_code == 200
    data = revs.json()
    assert len(data) >= 2
    assert data[0]["action"] == "publish"  # newest first
    assert data[0]["version"] > data[1]["version"]


async def test_sync_status(client: AsyncClient, admin_token: str):
    res = await client.get(
        "/api/v1/admin/system/sync-status",
        headers=_auth(admin_token),
        params={"test": "false"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert "revalidation_configured" in body
    assert "database" in body
    # Credentials must never appear in the reported DB URL.
    assert "Test!Pandit123" not in body["database"]


async def test_audit_log_lists(client: AsyncClient, admin_token: str):
    await _upload(client, admin_token)
    res = await client.get(
        "/api/v1/admin/system/audit",
        headers=_auth(admin_token),
        params={"entity": "media"},
    )
    assert res.status_code == 200
    assert res.json()["total"] >= 1
