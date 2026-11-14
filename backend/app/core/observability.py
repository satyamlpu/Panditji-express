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

import logging

from app.core.config import settings

log = logging.getLogger("panditji.observability")


def init_observability() -> None:
    """Initialise Sentry if configured. Safe to call once at startup."""
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
