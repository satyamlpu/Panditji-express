"""Service areas: CRUD, coverage check, RBAC."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import StaffRole
from app.models.admin_user import AdminUser
from tests.conftest import TestSession

KANPUR = {"center_lat": 26.4499, "center_lng": 80.3319}


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def _make_staff(email: str, role: str) -> None:
    async with TestSession() as s:
        s.add(
            AdminUser(
                email=email, full_name="Staffer",
                password_hash=hash_password("Test!Pandit123"),
                role=role, status=AdminStatus.ACTIVE,
            )
        )
        await s.commit()


async def _staff_token(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Test!Pandit123"}
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_crud_and_coverage(client: AsyncClient, admin_token):
    # Create.
    create = await client.post(
        "/api/v1/mp/admin/service-areas", headers=_auth(admin_token),
        json={"name": "Kanpur Central", "city": "Kanpur", "radius_km": 15,
              "pincodes": ["208001"], **KANPUR},
    )
    assert create.status_code == 201, create.text
    aid = create.json()["id"]
    assert create.json()["pincodes"] == ["208001"]

    # List + get.
    lst = await client.get("/api/v1/mp/admin/service-areas", headers=_auth(admin_token))
    assert len(lst.json()) == 1
    assert (
        await client.get(f"/api/v1/mp/admin/service-areas/{aid}", headers=_auth(admin_token))
    ).json()["name"] == "Kanpur Central"

    # Coverage: a point ~1km from centre is covered; a far point is not.
    near = await client.get(
        "/api/v1/mp/admin/service-areas/coverage?lat=26.455&lng=80.335",
        headers=_auth(admin_token),
    )
    assert near.json()["covered"] is True and len(near.json()["areas"]) == 1
    far = await client.get(
        "/api/v1/mp/admin/service-areas/coverage?lat=28.6&lng=77.2",  # Delhi
        headers=_auth(admin_token),
    )
    assert far.json()["covered"] is False

    # Deactivate → coverage excludes it.
    upd = await client.patch(
        f"/api/v1/mp/admin/service-areas/{aid}", headers=_auth(admin_token),
        json={"active": False},
    )
    assert upd.json()["active"] is False
    after = await client.get(
        "/api/v1/mp/admin/service-areas/coverage?lat=26.455&lng=80.335",
        headers=_auth(admin_token),
    )
    assert after.json()["covered"] is False

    # Delete.
    dele = await client.delete(
        f"/api/v1/mp/admin/service-areas/{aid}", headers=_auth(admin_token)
    )
    assert dele.status_code == 200
    assert (
        await client.get("/api/v1/mp/admin/service-areas", headers=_auth(admin_token))
    ).json() == []


@pytest.mark.asyncio
async def test_rbac_ops_only(client: AsyncClient):
    await _make_staff("fin@panditjiexpress.in", StaffRole.FINANCE)
    ftok = await _staff_token(client, "fin@panditjiexpress.in")
    assert (
        await client.get("/api/v1/mp/admin/service-areas", headers=_auth(ftok))
    ).status_code == 403
