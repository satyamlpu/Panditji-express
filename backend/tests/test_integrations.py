"""Phase 6 provider seams: SMS/OTP delivery abstraction + payment signature
verifiers. The real adapters (MSG91, Razorpay) are env-gated and never called
here — these tests prove the seam logic deterministically, offline."""

from __future__ import annotations

import hashlib
import hmac

from httpx import AsyncClient

from app.core import config
from app.marketplace import sms
from app.marketplace.payment_providers import (
    razorpay_payment_signature,
    verify_razorpay_payment_signature,
    verify_razorpay_webhook_signature,
)


async def test_otp_dev_returns_code_when_no_provider(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(config.settings, "sms_provider", "none", raising=False)
    r = await client.post(
        "/api/v1/mp/auth/otp/request",
        json={"phone": "+919000007000", "kind": "customer"},
    )
    assert r.status_code == 200
    # Dev + no provider → code is returned so the flow stays testable.
    assert r.json()["dev_code"] is not None


async def test_otp_code_hidden_when_provider_delivers(client: AsyncClient, monkeypatch):
    # "console" provider reports the code as delivered → it must NOT be echoed.
    monkeypatch.setattr(sms.settings, "sms_provider", "console", raising=False)
    r = await client.post(
        "/api/v1/mp/auth/otp/request",
        json={"phone": "+919000007001", "kind": "customer"},
    )
    assert r.status_code == 200
    assert r.json()["dev_code"] is None


async def test_send_otp_sms_none_returns_false(monkeypatch):
    monkeypatch.setattr(sms.settings, "sms_provider", "none", raising=False)
    assert await sms.send_otp_sms("+919000007002", "123456") is False


async def test_send_otp_sms_console_returns_true(monkeypatch):
    monkeypatch.setattr(sms.settings, "sms_provider", "console", raising=False)
    assert await sms.send_otp_sms("+919000007003", "123456") is True


def test_razorpay_payment_signature_roundtrip():
    sig = razorpay_payment_signature("order_123", "pay_456", "secret")
    assert verify_razorpay_payment_signature("order_123", "pay_456", sig, "secret")
    assert not verify_razorpay_payment_signature("order_123", "pay_456", "bad", "secret")
    # Wrong secret must not verify.
    assert not verify_razorpay_payment_signature("order_123", "pay_456", sig, "other")


def test_razorpay_webhook_signature():
    body = b'{"event":"payment.captured"}'
    good = hmac.new(b"whsec", body, hashlib.sha256).hexdigest()
    assert verify_razorpay_webhook_signature(body, good, "whsec")
    assert not verify_razorpay_webhook_signature(body, "deadbeef", "whsec")
    assert not verify_razorpay_webhook_signature(body, good, "wrong")
