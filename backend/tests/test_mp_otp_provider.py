"""OTP provider: mock (dev/staging) vs SMS (production), and the guards that
keep the mock code out of production. Covers the free testing environment."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.config import settings

OTP_REQ = "/api/v1/mp/auth/otp/request"
OTP_VER = "/api/v1/mp/auth/otp/verify"


async def test_mock_returns_fixed_code_and_verifies(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "otp_mode", "mock")
    monkeypatch.setattr(settings, "otp_test_numbers", "")  # unrestricted
    monkeypatch.setattr(settings, "otp_test_code", "123456")

    req = await client.post(OTP_REQ, json={"phone": "+917777700001", "kind": "customer"})
    assert req.status_code == 200
    assert req.json()["dev_code"] == "123456"  # fixed test code, no SMS

    ver = await client.post(
        OTP_VER, json={"phone": "+917777700001", "kind": "customer", "code": "123456"}
    )
    assert ver.status_code == 200
    assert ver.json().get("access_token")  # real JWT issued


async def test_mock_allowlist_blocks_unlisted_numbers(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "otp_mode", "mock")
    monkeypatch.setattr(settings, "otp_test_numbers", "+919999900000")

    ok = await client.post(OTP_REQ, json={"phone": "+919999900000", "kind": "customer"})
    assert ok.status_code == 200

    blocked = await client.post(OTP_REQ, json={"phone": "+918888800002", "kind": "customer"})
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "forbidden"


async def test_sms_mode_fails_closed_without_provider(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "otp_mode", "sms")
    monkeypatch.setattr(settings, "msg91_auth_key", "")  # no provider

    r = await client.post(OTP_REQ, json={"phone": "+916666600003", "kind": "customer"})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "sms_unavailable"
    # No real code is ever returned in SMS mode.
    assert r.json().get("dev_code") is None


def _prod(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 40)
    monkeypatch.setattr(settings, "payment_webhook_secret", "y" * 40)
    monkeypatch.setattr(settings, "revalidate_secret", "z" * 40)


def test_mock_refused_in_production(monkeypatch):
    _prod(monkeypatch)
    monkeypatch.setattr(settings, "otp_mode", "mock")
    with pytest.raises(RuntimeError, match="mock OTP provider cannot be enabled"):
        settings.validate_runtime()


def test_sms_mode_boots_in_production(monkeypatch):
    _prod(monkeypatch)
    monkeypatch.setattr(settings, "otp_mode", "sms")
    settings.validate_runtime()  # must not raise


def test_effective_mode_defaults_by_env(monkeypatch):
    monkeypatch.setattr(settings, "otp_mode", "")
    monkeypatch.setattr(settings, "app_env", "development")
    assert settings.otp_effective_mode == "mock"
    monkeypatch.setattr(settings, "app_env", "staging")
    assert settings.otp_effective_mode == "mock"
    monkeypatch.setattr(settings, "app_env", "production")
    assert settings.otp_effective_mode == "sms"
