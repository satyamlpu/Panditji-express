"""A small in-process fixed-window rate limiter.

Good enough for a single-instance deployment and for protecting the login and
public enquiry endpoints. For horizontal scale this would move to Redis — the
call site (`rate_limit(...)`) would not change.
"""

from __future__ import annotations

import threading
import time

_lock = threading.Lock()
# key -> (window_start_epoch, count)
_buckets: dict[str, tuple[float, int]] = {}


def rate_limit(key: str, limit: int, window_seconds: int = 60) -> bool:
    """Return True if the call is allowed, False if the limit is exceeded.

    A fixed window of ``window_seconds`` resets the count once it elapses.
    """
    now = time.time()
    with _lock:
        start, count = _buckets.get(key, (now, 0))
        if now - start >= window_seconds:
            start, count = now, 0
        count += 1
        _buckets[key] = (start, count)
        return count <= limit
