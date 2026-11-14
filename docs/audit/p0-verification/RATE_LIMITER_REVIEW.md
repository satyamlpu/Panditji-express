# Rate Limiter Review

**File:** `backend/app/core/ratelimit.py` (full rewrite)
**Call sites:** `app/api/routers/auth.py:55`, `app/marketplace/routers/auth.py:30`,
`app/marketplace/routers/customer.py:149`, `app/api/routers/public.py:223`

## What the code does (verified)

`rate_limit(key, limit, window_seconds=60)` is now an `async` coroutine over a
lazily-selected, process-wide singleton backend (`_get_backend()`, built once
under a lock, `ratelimit.py:131`). Backend selection (`_build_backend`,
`ratelimit.py:101`): `REDIS_URL` → Upstash REST pair → in-process. All four call
sites correctly `await` the call (diff verified). `reset()` (`:145`) drops the
singleton for tests.

| Backend | Mechanism | Evidence |
|---|---|---|
| Redis | `INCR rl:<key>`, `EXPIRE` on first hit | `_RedisBackend.allow`, `:59` |
| Upstash REST | one `POST /pipeline` with `[[INCR],[EXPIRE]]` | `_UpstashRestBackend.allow`, `:78` |
| In-process | locked fixed-window dict | `_InProcessBackend.allow`, `:42` |

- **Async usage:** correct. `redis.asyncio` client, `httpx.AsyncClient`, and a
  `threading.Lock` only around the pure in-memory dict / singleton build (never
  held across `await`). No blocking I/O on the event loop.
- **Key isolation:** verified good. Keys are route-prefixed and identity-scoped:
  `login:{ip}`, `mp_otp:{ip}:{phone}`, `mp_booking:{me.id}` (authenticated user
  id — strongest), `enquiry:{ip}`. No cross-route collision.
- **No header-spoofing bypass:** the limiter keys off `request.client.host`
  (`client_ip`, `deps.py` / `principals.py:130`) and **never** reads
  `X-Forwarded-For`. An attacker cannot spoof a header to get a fresh bucket.

## Findings

### R‑L1 — Redis/Upstash failure is fail-open, silently (MEDIUM, by design)
`_RedisBackend.allow` / `_UpstashRestBackend.allow` catch all exceptions, log a
warning, and **return `True`** (`:66`, `:92`). The module docstring states this
is deliberate ("a Redis outage must not take down login/booking").
- **Impact:** a Redis/Upstash outage **disables rate limiting entirely** for its
  duration — brute-force/DoS protection is gone, with only a log line. For a
  money system this is a real availability-vs-abuse trade-off, not a bug, but it
  must be an accepted, *monitored* condition.
- **Recommendation:** alert on the `panditji.ratelimit` warning (once Sentry/
  logging is wired), and consider a bounded in-process fallback during outage
  rather than unconditional allow. Document the decision in the risk register.

### R‑L2 — IP-based limits are unreliable behind the Vercel/Supabase proxy (MEDIUM)
`request.client.host` is the **immediate peer**, which on Vercel is the platform
edge/proxy, not the end user. Because XFF is (correctly, for anti-spoofing) not
trusted, the `login:{ip}` and `enquiry:{ip}` buckets may (a) collapse many users
behind one egress IP into a single bucket → **over-limiting** legitimate users,
or (b) see a rotating/edge IP → **under-limiting**.
- **Impact:** the two IP-keyed limits may be materially less effective (or too
  aggressive) in the actual serverless deployment. The user-id-keyed booking
  limit is unaffected and solid.
- **Recommendation:** derive the client IP from a *trusted* proxy header with a
  known hop count (e.g. the platform's `x-vercel-forwarded-for` / rightmost XFF
  entry), configured explicitly, rather than `request.client.host`. Verify in
  staging what `request.client.host` actually resolves to on Vercel.

### R‑L3 — INCR/EXPIRE not atomic on the Redis backend (LOW)
`_RedisBackend` issues `INCR` then, only if `count == 1`, a separate `EXPIRE`
(`:62`). If the process/connection dies between the two, the key has no TTL and
**never resets** → that one key is permanently blocked (over-blocking, *not* a
bypass). The Upstash backend avoids this (single pipeline). 
- **Recommendation:** make it atomic — `SET rl:<key> ... NX EX` + `INCR`, or a
  small Lua script / `redis` pipeline, matching the Upstash path.

### R‑L4 — fixed-window burst edge (LOW, inherent)
Fixed windows allow up to `2×limit` across a window boundary. Acceptable for
these limits; noted for completeness. A sliding window would remove it.

### R‑L5 — no multi-instance / failure test coverage (see TEST_EVIDENCE)
No test exercises the 429 path, the shared-store backends, or the fail-open
branch. The async conversion is only smoke-covered (every authed request calls
`await rate_limit`). Over-limit behaviour, Redis selection, and fail-open are
unverified by tests.

## Concurrency / multi-instance assessment
- In-process backend: correct on **one** instance only; across Vercel replicas /
  cold starts each process has its own counters → effective limit ≈ `limit ×
  instances`. The code logs a loud production warning for exactly this case
  (`:122`). Correct behaviour requires `REDIS_URL` or Upstash in production.
- Redis/Upstash: `INCR` is atomic server-side, so concurrent requests across
  instances count correctly (modulo R‑L3's TTL edge).

## Area status: **PASS WITH CONDITIONS**
Implementation is correct, well-isolated, and spoof-resistant. Conditions before
relying on it in production: provision a shared store (R‑L1 single-instance
warning), resolve the proxy-IP source (R‑L2), and treat fail-open as a monitored
risk. R‑L3/R‑L4 are low-priority hardening.
