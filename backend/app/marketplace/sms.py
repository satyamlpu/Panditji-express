"""SMS / OTP delivery.

Production delivers OTP codes over SMS via MSG91 (DLT-registered template).
When no provider is configured the call **fails closed** — it raises rather than
returning as if the message was sent — so an undelivered OTP never looks like a
success. The mock OTP provider (dev/staging) does not call this at all.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.core.errors import APIError

log = logging.getLogger("panditji.sms")

MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"


class SmsUnavailableError(APIError):
    """SMS provider missing or the gateway rejected the send (fail-closed)."""

    def __init__(self, message: str = "SMS service is temporarily unavailable.") -> None:
        super().__init__(message, code="sms_unavailable", status_code=503)


async def send_otp_sms(phone: str, code: str) -> None:
    """Send an OTP code via MSG91. Raises SmsUnavailableError on any failure.

    Only called in "sms" mode. The OTP template is registered in the MSG91
    dashboard under DLT; `code` is injected as the template's OTP variable.
    """
    if not settings.sms_configured:
        # Fail closed — never pretend an SMS was sent.
        raise SmsUnavailableError("SMS provider (MSG91) is not configured.")

    params = {
        "authkey": settings.msg91_auth_key,
        "mobile": phone.lstrip("+"),
        "otp": code,
    }
    if settings.msg91_otp_template_id:
        params["template_id"] = settings.msg91_otp_template_id
    if settings.msg91_sender_id:
        params["sender"] = settings.msg91_sender_id

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(MSG91_OTP_URL, params=params)
    except httpx.HTTPError as exc:
        log.error("MSG91 OTP send error: %s", exc)
        raise SmsUnavailableError("Could not reach the SMS provider.") from exc

    # MSG91 returns {"type": "success"|"error", ...}
    ok = resp.status_code < 400
    if ok:
        try:
            ok = (resp.json() or {}).get("type") != "error"
        except ValueError:
            ok = True
    if not ok:
        log.error("MSG91 OTP send rejected: %s %s", resp.status_code, resp.text[:200])
        raise SmsUnavailableError("Could not send the OTP SMS.")
