"""Security response headers applied to every backend response.

The frontend serves its own headers too (next.config.ts); these protect the
API responses and any content served directly from FastAPI (e.g. /docs).
"""

from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import settings
from app.core.observability import request_id_var, set_sentry_request_id

_req_log = logging.getLogger("panditji.request")
_REQUEST_ID_HEADER = "X-Request-ID"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a correlation id to every request and logs its completion.

    Honours an inbound ``X-Request-ID`` (so a load balancer / client trace id
    flows through), otherwise generates one. Binds it to a contextvar for log
    correlation and the Sentry scope, echoes it back in the response header, and
    logs one structured line per request (method, path, status, latency) — never
    any body, header or credential content.
    """

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(_REQUEST_ID_HEADER)
        request_id = incoming if incoming else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        set_sentry_request_id(request_id)
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers[_REQUEST_ID_HEADER] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            # Health checks are frequent and noisy; keep them at DEBUG.
            level = logging.DEBUG if request.url.path.startswith("/health") else logging.INFO
            _req_log.log(
                level,
                "%s %s -> %s (%sms)",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
            )
            request_id_var.reset(token)


_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    # The API returns JSON only; lock scripting/embedding down hard.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for key, value in _HEADERS.items():
            response.headers.setdefault(key, value)
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response
