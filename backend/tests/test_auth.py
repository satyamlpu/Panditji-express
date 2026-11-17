"""Authentication and authorization."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD


async def test_login_success(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["user"]["email"] == ADMIN_EMAIL


async def test_login_wrong_password(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong"},
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"


async def test_me_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401


async def test_admin_routes_deny_without_token(client: AsyncClient):
    res = await client.get("/api/v1/admin/services")
    assert res.status_code == 401


async def test_admin_routes_allow_with_token(client: AsyncClient, admin_token: str):
    res = await client.get(
        "/api/v1/admin/services",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.json()["total"] == 2  # published + draft


async def test_admin_change_password(client: AsyncClient, admin_token: str):
    auth = {"Authorization": f"Bearer {admin_token}"}
    new_pw = "BrandNewPass!123"

    # wrong current password → 401
    bad = await client.post(
        "/api/v1/auth/change-password",
        headers=auth,
        json={"current_password": "wrong", "new_password": new_pw},
    )
    assert bad.status_code == 401

    # too-short new password → 422 (min_length=12)
    short = await client.post(
        "/api/v1/auth/change-password",
        headers=auth,
        json={"current_password": ADMIN_PASSWORD, "new_password": "short"},
    )
    assert short.status_code == 422

    # success
    ok = await client.post(
        "/api/v1/auth/change-password",
        headers=auth,
        json={"current_password": ADMIN_PASSWORD, "new_password": new_pw},
    )
    assert ok.status_code == 200

    # old password no longer logs in; new one does
    old = await client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert old.status_code == 401
    new = await client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": new_pw},
    )
    assert new.status_code == 200
