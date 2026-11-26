"""Payment provider seam.

The ledger, idempotency and webhook-handling flow in ``finance.py`` is gateway
-agnostic and stays unchanged; a real provider only differs in how it signs the
checkout callback and the webhook. These are pure, side-effect-free verifiers so
they are fully unit-testable without network or live keys. The real adapter
(order creation) is wired when ``settings.payment_provider`` is switched and keys
are provided — until then the mock gateway remains in effect.

Razorpay signature schemes (as documented by Razorpay):
* Checkout: HMAC-SHA256(key_secret, "<order_id>|<payment_id>") hex.
* Webhook:  HMAC-SHA256(webhook_secret, <raw_request_body>) hex.
"""

from __future__ import annotations

import hashlib
import hmac


def _hmac_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def razorpay_payment_signature(order_id: str, payment_id: str, secret: str) -> str:
    """The signature Razorpay expects for a successful checkout callback."""
    return _hmac_hex(secret, f"{order_id}|{payment_id}".encode())


def verify_razorpay_payment_signature(
    order_id: str, payment_id: str, signature: str, secret: str
) -> bool:
    expected = razorpay_payment_signature(order_id, payment_id, secret)
    return hmac.compare_digest(expected, signature or "")


def verify_razorpay_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    """Constant-time check of the X-Razorpay-Signature header against the body."""
    expected = _hmac_hex(secret, body)
    return hmac.compare_digest(expected, signature or "")
