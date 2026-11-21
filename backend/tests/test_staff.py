"""Staff & role management (super-admin only) with lockout guards."""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.constants import AdminStatus, Role
from app.core.security import hash_password
from app.models.admin_user import AdminUser
from tests.conftest import ADMIN_EMAIL, TestSession


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def ops_user_id() -> str:
    async with TestSession() as s:
        u = AdminUser(
            email="ops@panditjiexpress.in",
            full_name="Ops User",
            password_hash=hash_password("x-not-used"),
            role="ops",
            status=AdminStatus.ACTIVE,
        )
        s.add(u)
        await s.commit()
        return str(u.id)


async def _admin_id(email: str) -> str:
    async with TestSession() as s:
        u = (await s.execute(select(AdminUser).where(AdminUser.email == email))).scalar_one()
        return str(u.id)


async def test_staff_list_requires_auth(client: AsyncClient):
    assert (await client.get("/api/v1/admin/staff")).status_code == 401


async def test_list_and_assign_role(client: AsyncClient, admin_token, ops_user_id):
    lst = await client.get("/api/v1/admin/staff", headers=_auth(admin_token))
    assert lst.status_code == 200
    assert any(u["id"] == ops_user_id for u in lst.json())

    # Reassign the ops user to finance.
    r = await client.patch(
        f"/api/v1/admin/staff/{ops_user_id}",
        headers=_auth(admin_token),
        json={"role": "finance"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "finance"

    # Disable the account.
    r2 = await client.patch(
        f"/api/v1/admin/staff/{ops_user_id}",
        headers=_auth(admin_token),
        json={"status": "disabled"},
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "disabled"


async def test_invalid_role_rejected(client: AsyncClient, admin_token, ops_user_id):
    r = await client.patch(
        f"/api/v1/admin/staff/{ops_user_id}",
        headers=_auth(admin_token),
        json={"role": "superuser"},
    )
    assert r.status_code == 422


async def test_cannot_lock_out_self(client: AsyncClient, admin_token):
    me = await _admin_id(ADMIN_EMAIL)
    # Demoting own super-admin role must be blocked.
    r = await client.patch(
        f"/api/v1/admin/staff/{me}",
        headers=_auth(admin_token),
        json={"role": "ops"},
    )
    assert r.status_code == 409
    # Still an active admin afterwards.
    async with TestSession() as s:
        u = (await s.execute(select(AdminUser).where(AdminUser.email == ADMIN_EMAIL))).scalar_one()
        assert u.role == Role.ADMIN and u.status == AdminStatus.ACTIVE
