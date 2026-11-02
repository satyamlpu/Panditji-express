"""Payment gateway callbacks.

`/webhooks/mock` is the trusted path: it verifies the provider signature on the
raw body and records the payment idempotently. `/mock/pay` is a dev-only
convenience that makes the server play the gateway (it still goes through the
same `record_paid` posting) so the flow is demoable without a real provider.
"""

from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import APIError, UnauthorizedError
from app.db.session import get_session
from app.marketplace import finance

router = APIRouter(prefix="/api/v1/mp/payments", tags=["mp:payments"])


@router.post("/webhooks/mock")
async def mock_webhook(
    request: Request,
    x_mock_signature: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Provider → platform callback. Signature-verified + idempotent."""
    body = await request.body()
    if not finance.verify_signature(body, x_mock_signature):
        raise UnauthorizedError("Invalid webhook signature")
    try:
        data = json.loads(body)
    except ValueError:
        raise APIError("Invalid payload", code="validation_error", status_code=422) from None

    order_id = data.get("provider_order_id")
    payment_id = data.get("provider_payment_id")
    if data.get("status") != "paid" or not order_id or not payment_id:
        raise APIError("Unsupported event", code="validation_error", status_code=422)

    payment = await finance.record_paid(session, order_id, payment_id)
    return {"ok": True, "status": payment.status}


@router.post("/mock/pay")
async def mock_pay(
    body: dict,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """DEV ONLY: simulate the gateway confirming an order (plays the provider)."""
    if settings.is_production:
        raise APIError("Not available", code="forbidden", status_code=403)
    order_id = body.get("provider_order_id")
    if not order_id:
        raise APIError("provider_order_id required", code="validation_error", status_code=422)
    payment = await finance.record_paid(session, order_id, "pay_" + secrets.token_hex(10))
    return {"ok": True, "status": payment.status, "payment_id": str(payment.id)}
