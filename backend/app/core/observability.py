"""Error monitoring wiring (Sentry).

A no-op unless ``SENTRY_DSN`` is set, so dev, tests and CI never reach out to the
network and the dependency is optional at runtime. In production, set
``SENTRY_DSN`` to capture unhandled errors; ``SENTRY_TRACES_SAMPLE_RATE`` (0–1)
optionally enables performance tracing.

PII is not sent by default (``send_default_pii=False``) — request bodies,
headers and cookies that could carry phone numbers, tokens or addresses stay out
of Sentry.
"""

from __future__ import annotations

import contextvars
import logging

from app.core.config import settings

log = logging.getLogger("panditji.observability")

# Correlation id for the current request, propagated via a contextvar so every
# log record emitted while handling a request can carry it (set by
# RequestContextMiddleware). "-" when no request is in scope (startup, jobs).
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


def get_request_id() -> str:
    return request_id_var.get()


class _RequestIdFilter(logging.Filter):
    """Injects the current request id onto every log record as ``request_id``."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


_LOGGING_CONFIGURED = False


def configure_logging() -> None:
    """Structured, request-id-aware logging. Idempotent and safe in tests/CI.

    Attaches a single stream handler whose formatter includes the correlation
    id, so a log line can be traced to the request that produced it. No log
    content includes document bytes, secrets or credentials — only route-level
    metadata (method, path, status, latency).
    """
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"
        )
    )
    handler.addFilter(_RequestIdFilter())
    root = logging.getLogger()
    # Replace our own handler only; leave uvicorn's handlers alone.
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if settings.debug else logging.INFO)
    _LOGGING_CONFIGURED = True


def set_sentry_request_id(request_id: str) -> None:
    """Tag the active Sentry scope with the request id, if Sentry is active."""
    try:
        import sentry_sdk

        sentry_sdk.set_tag("request_id", request_id)
    except Exception:  # Sentry not installed/initialised — fine.
        pass


def init_observability() -> None:
    """Initialise logging + Sentry (if configured). Safe to call once at startup."""
    configure_logging()
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            send_default_pii=False,
        )
        log.info("Sentry initialised (environment=%s)", settings.app_env)
    except Exception:
        log.warning("SENTRY_DSN set but Sentry init failed", exc_info=True)
