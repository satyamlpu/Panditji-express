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
