"""Security regression: the FastAPI backend is the only authorized gateway to the
data. Sensitive endpoints must reject anonymous and unauthorized access, so that
even though the DB sits behind Supabase, no data leaks without going through the
app's own auth. (The Supabase Data API is additionally locked down at the DB
level by migration e7a1b2c3d4f5 — anon/authenticated roles lose all access; that
role-level part only exists on the Supabase instance, so it's asserted here only
at the gateway layer, which is what every client actually uses.)"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

# (method, path) that expose or mutate sensitive data and MUST require auth.
_SENSITIVE = [
    ("get", "/api/v1/mp/customer/bookings"),            # customer booking history
    ("get", "/api/v1/mp/customer/profile"),             # customer PII
    ("get", "/api/v1/mp/partner/profile"),              # pandit profile
    ("get", "/api/v1/mp/partner/verification"),         # KYC verification status
    ("get", "/api/v1/mp/admin/pandits"),                # staff: all partners
    ("get", "/api/v1/mp/admin/analytics"),              # staff: ops analytics
    ("get", "/api/v1/mp/admin/finance/payouts"),        # staff: financial data
    ("get", "/api/v1/admin/settings"),                  # admin: site settings
    ("get", "/api/v1/admin/staff"),                     # super-admin: staff/roles
    ("get", "/api/v1/admin/media"),                     # admin: media library
]


@pytest.mark.parametrize("method,path", _SENSITIVE)
async def test_sensitive_endpoint_rejects_anonymous(
    client: AsyncClient, method: str, path: str
):
    resp = await getattr(client, method)(path)
    assert resp.status_code == 401, f"{method.upper()} {path} -> {resp.status_code} (expected 401)"


async def test_cross_role_token_is_rejected(client: AsyncClient):
    """A staff/admin endpoint must reject a bogus/garbage bearer token."""
    r = await client.get(
        "/api/v1/mp/admin/pandits", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert r.status_code == 401


async def test_public_endpoints_leak_no_sensitive_fields(client: AsyncClient):
    """Public catalogue endpoints are intentionally open but must not expose
    customer/pandit PII, KYC or financial fields."""
    r = await client.get("/api/v1/public/services")
    assert r.status_code == 200
    body = r.text.lower()
    for leaked in ("phone", "aadhaar", "kyc", "payout", "ledger", "password", "token"):
        assert leaked not in body, f"public /services leaks '{leaked}'"


def test_security_lockdown_migration_present_and_guarded():
    """The DB-level Data API lockdown migration exists and is Postgres-guarded
    (so it is a safe no-op on SQLite/dev and on CI Postgres without Supabase roles)."""
    from pathlib import Path

    versions = Path(__file__).resolve().parent.parent / "alembic" / "versions"
    f = versions / "e7a1b2c3d4f5_security_lockdown_data_api_rls.py"
    assert f.is_file(), "security lockdown migration missing"
    src = f.read_text()
    assert 'dialect.name == "postgresql"' in src          # guarded
    assert "REVOKE USAGE ON SCHEMA public FROM anon" in src
    assert "ENABLE ROW LEVEL SECURITY" in src
    assert "rolname = 'anon'" in src                       # role-existence guarded
