"""Rate limiter: fixed-window behaviour of the in-process backend + the
request-correlation-id middleware. (Redis/Upstash backends are config-selected
and fail open; that path is covered by code review, not a live Redis in CI.)"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core import ratelimit


@pytest.fixture(autouse=True)
def _fresh_limiter():
    ratelimit.reset()
    yield
    ratelimit.reset()


async def test_allows_up_to_limit_then_blocks():
    key = "test:allow"
    results = [await ratelimit.rate_limit(key, 3, window_seconds=60) for _ in range(4)]
    assert results == [True, True, True, False]


async def test_separate_keys_are_independent():
    assert await ratelimit.rate_limit("a", 1, window_seconds=60) is True
    assert await ratelimit.rate_limit("a", 1, window_seconds=60) is False
    # A different key has its own bucket.
    assert await ratelimit.rate_limit("b", 1, window_seconds=60) is True


async def test_window_resets_after_expiry():
    key = "test:window"
    assert await ratelimit.rate_limit(key, 1, window_seconds=0) is True
    # window_seconds=0 means every call starts a fresh window → never blocks.
    assert await ratelimit.rate_limit(key, 1, window_seconds=0) is True


async def test_reset_clears_counters():
    assert await ratelimit.rate_limit("c", 1, window_seconds=60) is True
    assert await ratelimit.rate_limit("c", 1, window_seconds=60) is False
    ratelimit.reset()
    assert await ratelimit.rate_limit("c", 1, window_seconds=60) is True


async def test_otp_endpoint_is_rate_limited(client: AsyncClient):
    """The OTP request route enforces a per-IP+phone limit (5 / 10 min)."""
    ratelimit.reset()
    last = None
    for _ in range(6):
        last = await client.post(
            "/api/v1/mp/auth/otp/request",
            json={"phone": "+919000009999", "kind": "customer"},
        )
    assert last is not None and last.status_code == 429


async def test_response_carries_correlation_id(client: AsyncClient):
    r = await client.get("/health")
    assert r.headers.get("X-Request-ID")


async def test_inbound_correlation_id_is_echoed(client: AsyncClient):
    r = await client.get("/health", headers={"X-Request-ID": "trace-abc-123"})
    assert r.headers.get("X-Request-ID") == "trace-abc-123"
