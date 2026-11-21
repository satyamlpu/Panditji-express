"""Pluggable SMS/OTP delivery.

The provider is chosen by ``settings.sms_provider`` and the real adapter is
env-gated, so dev/CI never reach the network:

* ``none``    — not sent (the caller returns the code in the response, dev only).
* ``console`` — logged and treated as "sent" (dev/staging smoke tests).
* ``msg91``   — sent via MSG91's DLT flow API using env credentials (prod).

``send_otp_sms`` returns True only when the code was handed to a real delivery
channel. A provider error is logged and returns False (so the caller can decide
how to degrade); the OTP code itself is never logged.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

log = logging.getLogger("panditji.sms")


async def _send_msg91(phone: str, code: str) -> bool:
    if not (settings.msg91_auth_key and settings.msg91_dlt_template_id):
        log.error("sms_provider=msg91 but MSG91 credentials are not configured")
        return False
    # MSG91 OTP/flow endpoint. The DLT template owns the message text; we pass
    # only the variable (the code) and the destination. Never log the code.
    url = "https://control.msg91.com/api/v5/flow/"
    payload = {
        "template_id": settings.msg91_dlt_template_id,
        "sender": settings.msg91_sender_id,
        "recipients": [{"mobiles": phone.lstrip("+"), "otp": code}],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.post(
                url, json=payload, headers={"authkey": settings.msg91_auth_key}
            )
        if resp.status_code >= 400:
            log.error("MSG91 send failed (%s)", resp.status_code)
            return False
        return True
    except Exception:
        log.error("MSG91 send error", exc_info=True)
        return False


async def send_otp_sms(phone: str, code: str) -> bool:
    """Deliver an OTP via the configured provider. Returns True if handed off."""
    provider = (settings.sms_provider or "none").lower()
    if provider == "none":
        return False
    if provider == "console":
        log.info("OTP for %s queued via console provider", phone)
        return True
    if provider == "msg91":
        return await _send_msg91(phone, code)
    log.error("unknown sms_provider=%r; not sending", provider)
    return False
