"""App-release management (admin CRUD) + the public /download feed."""

from __future__ import annotations

from httpx import AsyncClient


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_admin_create_requires_auth(client: AsyncClient):
    r = await client.post(
        "/api/v1/admin/app-releases",
        json={"app_type": "customer", "platform": "android", "version": "1.0.0"},
    )
    assert r.status_code == 401


async def test_create_and_public_shows_only_active(client: AsyncClient, admin_token):
    # active customer/android build with a real URL
    r1 = await client.post(
        "/api/v1/admin/app-releases",
        headers=_auth(admin_token),
        json={
            "app_type": "customer",
            "platform": "android",
            "channel": "beta",
            "version": "1.0.0",
            "build_number": 10,
            "download_url": "https://example.com/customer-1.0.0.apk",
            "checksum_sha256": "abc123",
            "is_active": True,
        },
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["is_active"] is True

    # inactive partner/ios build (no URL yet)
    r2 = await client.post(
        "/api/v1/admin/app-releases",
        headers=_auth(admin_token),
        json={"app_type": "partner", "platform": "ios", "version": "0.9.0"},
    )
    assert r2.status_code == 201
    assert r2.json()["is_active"] is False
    inactive_id = r2.json()["id"]

    # public feed: only the active one, and no internal fields (no id/is_active)
    pub = await client.get("/api/v1/public/app-releases")
    assert pub.status_code == 200
    data = pub.json()
    assert len(data) == 1
    assert data[0]["app_type"] == "customer"
    assert data[0]["checksum_sha256"] == "abc123"
    assert "id" not in data[0] and "is_active" not in data[0]

    # activate the partner build → public now shows two
    up = await client.patch(
        f"/api/v1/admin/app-releases/{inactive_id}",
        headers=_auth(admin_token),
        json={"is_active": True, "download_url": "https://testflight.apple.com/join/xxxx"},
    )
    assert up.status_code == 200
    pub2 = await client.get("/api/v1/public/app-releases")
    assert len(pub2.json()) == 2


async def test_invalid_app_type_rejected(client: AsyncClient, admin_token):
    r = await client.post(
        "/api/v1/admin/app-releases",
        headers=_auth(admin_token),
        json={"app_type": "robot", "platform": "android", "version": "1.0.0"},
    )
    assert r.status_code == 422


async def test_delete_release(client: AsyncClient, admin_token):
    r = await client.post(
        "/api/v1/admin/app-releases",
        headers=_auth(admin_token),
        json={"app_type": "customer", "platform": "ios", "version": "1.1.0", "is_active": True},
    )
    rid = r.json()["id"]
    d = await client.delete(f"/api/v1/admin/app-releases/{rid}", headers=_auth(admin_token))
    assert d.status_code == 200
    # gone from admin list
    lst = await client.get("/api/v1/admin/app-releases", headers=_auth(admin_token))
    assert all(row["id"] != rid for row in lst.json())
