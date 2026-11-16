"""Fixed-window rate limiter with a pluggable store.

The public API is a single coroutine::

    allowed = await rate_limit(key, limit, window_seconds=60)

It returns ``True`` if the call is within the limit, ``False`` if it should be
rejected (HTTP 429 at the call site).

Backend selection (first that is configured wins), decided once at first use:

1. ``REDIS_URL`` via ``redis.asyncio`` — standard Redis / Upstash TCP / etc.
2. ``UPSTASH_REDIS_REST_URL`` + ``UPSTASH_REDIS_REST_TOKEN`` — Upstash REST over
   httpx (ideal for Vercel serverless; no persistent connection).
3. In-process fixed window — correct only on a single instance. On production
   with no shared store configured a loud warning is logged, because per-
   instance counters do not hold across serverless cold starts / replicas.

A shared store that errors at request time *fails open* (the call is allowed and
a warning is logged): a Redis outage must not take down login/booking. This
trades the DoS-protection property for availability during an infra outage.
"""

from __future__ import annotations

import logging
import threading
import time

from app.core.config import settings

log = logging.getLogger("panditji.ratelimit")


class _InProcessBackend:
    """Single-instance fixed window. Fine for dev and single-node deploys."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: dict[str, tuple[float, int]] = {}

    async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        with self._lock:
            start, count = self._buckets.get(key, (now, 0))
            if now - start >= window_seconds:
                start, count = now, 0
            count += 1
            self._buckets[key] = (start, count)
            return count <= limit


class _RedisBackend:
    """Shared fixed window via ``redis.asyncio`` (INCR + first-hit EXPIRE)."""

    def __init__(self, client) -> None:
        self._r = client

    async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        rk = f"rl:{key}"
        try:
            count = await self._r.incr(rk)
            if count == 1:
                await self._r.expire(rk, window_seconds)
            return int(count) <= limit
        except Exception:
            log.warning("rate-limit redis error; allowing request", exc_info=True)
            return True


class _UpstashRestBackend:
    """Shared fixed window via the Upstash REST pipeline (one round trip)."""

    def __init__(self, url: str, token: str) -> None:
        self._url = url.rstrip("/") + "/pipeline"
        self._headers = {"Authorization": f"Bearer {token}"}

    async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        import httpx

        rk = f"rl:{key}"
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.post(
                    self._url,
                    headers=self._headers,
                    json=[["INCR", rk], ["EXPIRE", rk, window_seconds]],
                )
                resp.raise_for_status()
                count = int(resp.json()[0]["result"])
                return count <= limit
        except Exception:
            log.warning("rate-limit upstash error; allowing request", exc_info=True)
            return True


_backend: _InProcessBackend | _RedisBackend | _UpstashRestBackend | None = None
_backend_lock = threading.Lock()


def _build_backend():
    if settings.redis_url:
        try:
            import redis.asyncio as aioredis

            client = aioredis.from_url(
                settings.redis_url, encoding="utf-8", decode_responses=True
            )
            log.info("rate limiter: using Redis (REDIS_URL)")
            return _RedisBackend(client)
        except Exception:
            log.warning(
                "rate limiter: REDIS_URL set but redis.asyncio unavailable; "
                "falling back",
                exc_info=True,
            )
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        log.info("rate limiter: using Upstash REST")
        return _UpstashRestBackend(
            settings.upstash_redis_rest_url, settings.upstash_redis_rest_token
        )
    if settings.is_production:
        log.warning(
            "rate limiter: no shared store configured (REDIS_URL / Upstash); "
            "using in-process counters, which DO NOT hold across serverless "
            "instances. Configure a shared store for effective limiting."
        )
    return _InProcessBackend()


def _get_backend():
    global _backend
    if _backend is None:
        with _backend_lock:
            if _backend is None:
                _backend = _build_backend()
    return _backend


async def rate_limit(key: str, limit: int, window_seconds: int = 60) -> bool:
    """Return True if the call is allowed, False if the limit is exceeded."""
    return await _get_backend().allow(key, limit, window_seconds)


def reset() -> None:
    """Drop the active backend so the next call rebuilds a fresh one.

    For tests: clears in-process counters between cases without reaching into
    backend internals. (The next ``rate_limit`` call re-selects the backend.)
    """
    global _backend
    with _backend_lock:
        _backend = None
