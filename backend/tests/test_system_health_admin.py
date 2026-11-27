"""System health: DB check, counters, config posture (no secrets), RBAC."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import Availability, PanditStatus, StaffRole
from app.marketplace.models import Customer, Pandit
from app.models.admin_user import AdminUser
from tests.conftest import TestSession


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
async def test_health_db_counters_and_config(client: AsyncClient, admin_token):
    async with TestSession() as s:
        s.add(Customer(phone="+919999900000", name="Asha"))
        s.add(Pandit(phone="+919000000001", name="P", base_lat=26.4, base_lng=80.3,
                     status=PanditStatus.APPROVED, availability=Availability.ONLINE))
        await s.commit()

    res = await client.get("/api/v1/mp/admin/system/health", headers=_auth(admin_token))
    assert res.status_code == 200, res.text
    d = res.json()
    assert d["database"]["status"] == "connected"
    assert d["database"]["dialect"] == "sqlite"
    assert d["counters"]["customers"] == 1
    assert d["counters"]["pandits_approved"] == 1
    assert d["counters"]["pandits_online"] == 1
    # Config posture is present and secret-free.
    cfg = d["config"]
    assert cfg["environment"] == "development"
    assert cfg["geo_backend"] == "haversine"
    assert "commission_percent" in cfg
    # No secret value is ever echoed.
    blob = str(d)
    assert "jwt_secret" not in blob and "service_key" not in blob
    assert "webhook_secret" not in blob and "password" not in blob


@pytest.mark.asyncio
async def test_rbac_super_admin_only(client: AsyncClient):
    await _make_staff("ops@panditjiexpress.in", StaffRole.OPS)
    otok = await _staff_token(client, "ops@panditjiexpress.in")
    assert (
        await client.get("/api/v1/mp/admin/system/health", headers=_auth(otok))
    ).status_code == 403
