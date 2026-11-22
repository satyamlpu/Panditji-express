"""Media Library: admin uploads an image, the public proxy serves it, listing
and alt-text edits work, and deletion is blocked while the image is in use."""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.marketplace import storage
from tests.conftest import TestSession

# A minimal valid 1x1 PNG.
_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f6b0000000049454e44ae426082"
)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(autouse=True)
def _local_media(tmp_path, monkeypatch):
    """Keep uploaded bytes inside the test's tmp dir, not the repo."""
    monkeypatch.setattr(storage.settings, "storage_backend", "local", raising=False)
    monkeypatch.setattr(
        storage.settings,
        "media_storage_local_dir",
        str(tmp_path / "media"),
        raising=False,
    )


async def _upload(client: AsyncClient, token: str, name: str = "hero.png") -> dict:
    r = await client.post(
        "/api/v1/admin/media",
        headers=_auth(token),
        files={"file": (name, _PNG, "image/png")},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_upload_list_and_public_fetch(client: AsyncClient, admin_token):
    body = await _upload(client, admin_token)
    assert body["path"] == f"/api/v1/public/media/{body['id']}"
    assert body["url"].endswith(body["path"])
    assert body["size_bytes"] == len(_PNG)

    listing = await client.get("/api/v1/admin/media", headers=_auth(admin_token))
    assert listing.status_code == 200
    rows = listing.json()
    assert len(rows) == 1 and rows[0]["id"] == body["id"]

    # Public proxy serves the exact bytes with the right content type — no auth.
    img = await client.get(body["path"])
    assert img.status_code == 200
    assert img.content == _PNG
    assert img.headers["content-type"].startswith("image/png")
    assert "immutable" in img.headers.get("cache-control", "")


async def test_upload_requires_admin(client: AsyncClient):
    r = await client.post(
        "/api/v1/admin/media", files={"file": ("x.png", _PNG, "image/png")}
    )
    assert r.status_code == 401


async def test_rejects_non_image(client: AsyncClient, admin_token):
    r = await client.post(
        "/api/v1/admin/media",
        headers=_auth(admin_token),
        files={"file": ("evil.svg", b"<svg onload=alert(1)>", "image/svg+xml")},
    )
    assert r.status_code == 415


async def test_rejects_oversize(client: AsyncClient, admin_token, monkeypatch):
    from app.core import config

    monkeypatch.setattr(
        config.settings, "media_max_upload_bytes", 8, raising=False
    )
    r = await client.post(
        "/api/v1/admin/media",
        headers=_auth(admin_token),
        files={"file": ("big.png", _PNG, "image/png")},
    )
    assert r.status_code == 413


async def test_update_alt_text(client: AsyncClient, admin_token):
    body = await _upload(client, admin_token)
    r = await client.patch(
        f"/api/v1/admin/media/{body['id']}",
        headers=_auth(admin_token),
        json={"alt_text": "Priest performing a havan"},
    )
    assert r.status_code == 200
    assert r.json()["alt_text"] == "Priest performing a havan"


async def test_search_by_filename(client: AsyncClient, admin_token):
    await _upload(client, admin_token, name="ganesh-puja.png")
    await _upload(client, admin_token, name="griha-pravesh.png")
    r = await client.get(
        "/api/v1/admin/media", headers=_auth(admin_token), params={"q": "ganesh"}
    )
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1 and rows[0]["filename"] == "ganesh-puja.png"


async def test_delete_blocked_while_in_use(client: AsyncClient, admin_token):
    from app.models.banner import HomepageSection

    body = await _upload(client, admin_token)

    # Reference the image from a homepage section (as the inline picker would).
    async with TestSession() as s:
        s.add(
            HomepageSection(
                kind="hero", heading="Welcome", image_url=body["url"], status="published"
            )
        )
        await s.commit()

    blocked = await client.delete(
        f"/api/v1/admin/media/{body['id']}", headers=_auth(admin_token)
    )
    assert blocked.status_code == 409
    assert "in use" in blocked.json()["error"]["message"].lower()

    # Clear the reference, then deletion succeeds and the proxy 404s.
    async with TestSession() as s:
        from sqlalchemy import update

        await s.execute(update(HomepageSection).values(image_url=None))
        await s.commit()

    ok = await client.delete(
        f"/api/v1/admin/media/{body['id']}", headers=_auth(admin_token)
    )
    assert ok.status_code == 200

    gone = await client.get(body["path"])
    assert gone.status_code == 404


@pytest.mark.parametrize("bad", ["not-a-uuid", "00000000-0000-0000-0000-000000000000"])
async def test_public_media_unknown_is_404(client: AsyncClient, bad):
    r = await client.get(f"/api/v1/public/media/{bad}")
    assert r.status_code == 404
