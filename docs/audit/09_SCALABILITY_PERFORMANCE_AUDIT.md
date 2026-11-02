# 09 — Scalability & Performance Audit

**Target ambition:** millions of registered users, UP-wide, Android+iOS. **Current ceiling:** a single-instance, SQLite-backed deployment. The gap is large but the code is mostly stateless and portable, so the path is clear.

> **"Millions of users" readiness is NOT VERIFIED** — no load testing was performed or permitted in this read-only audit. Claims below are architectural, not measured.

## Bottlenecks (ranked)
1. **SQLite dev/test DB (single writer).** `config.py:31`, `db/session.py`. One writer at a time; no concurrency. Postgres is wired (driver normalization) but **psycopg is commented out / not installed**, and the booking/finance logic leans on SQLite's global write lock to *mask* the missing row locks (see `05`/`07`). → Migrate to Postgres; add the locks; enable psycopg.
2. **No horizontal scalability of in-process state.** The rate limiter is an in-memory dict (`core/ratelimit.py`) and dispatch timing is read-triggered in-process — both break across >1 instance. → Redis-backed limiter + a shared job queue.
3. **O(n) geo matching.** Eligibility is an in-Python haversine scan over candidate pandits on **unindexed float columns** (`dispatch.py`, `04`§E). Fine at seed scale; linear per booking at city scale. → PostGIS `ST_DWithin` + GiST.
4. **No background workers / scheduler.** Expiry, scheduled dispatch, payouts, notifications all absent or read-triggered. → Durable queue (RQ/Celery/arq) + worker.
5. **Polling tracking.** Customers poll `/tracking` every ~4s per active booking → N×(active bookings) req/s; and no shared state means every instance serves cold. → Realtime channel (WebSocket/managed) + Redis pub/sub.
6. **Local-disk media + no CDN.** `uploads/` + StaticFiles (`main.py:88-90`) — not shareable across instances, no edge caching. → Object storage (S3/GCS) + CDN; `next/image` or signed URLs.
7. **Connection pool unsized.** `session.py` sets only `pool_pre_ping`; Postgres would use defaults (5/10). → Tune `pool_size`/`max_overflow`/`pool_recycle`/`pool_timeout` to instance count × worker concurrency.
8. **No cache layer.** Discovery/serviceability/service catalogue are read-heavy and currently hit the DB every time. → Redis cache with short TTL + invalidation on publish (the Next.js revalidate hook already exists for the public site).
9. **No queue isolation for payment webhooks.** Webhooks processed inline in the request; a gateway retry storm hits the DB directly. → Enqueue + idempotent worker.

## Workload analysis (A–H)
| Workload | Pattern | Current handling | Risk | Fix |
|---|---|---|---|---|
| A. Customer API | read-heavy (discovery) + spiky booking | direct DB | cache-less reads | Redis cache + PG read replica |
| B. Pandit app | heartbeats + offer polls + location posts | direct DB writes | write amplification on `mp_pandit` | batch/throttle; Redis for heartbeat/availability |
| C. Admin ops | low volume, complex queries | direct DB | fine; add indexes | composite indexes (`04`) |
| D. Booking/dispatch writes | contended, correctness-critical | unlocked check-then-set | **double-assignment** | row locks + unique invariant + queue |
| E. GPS updates | high-frequency small writes | overwrite row | hot-row contention at scale | Redis/stream, write-behind |
| F. Notifications | fan-out | records only, no delivery | not implemented | queue + provider (push/SMS) |
| G. Payment webhooks | bursty, idempotency-critical | inline, racy | **double-credit** | queue + locked idempotent worker |
| H. Analytics queries | heavy aggregates | live on OLTP | contends with OLTP | read replica / warehouse later |

## Capacity model (assumptions stated; illustrative, NOT measured)
Assume launch city-cluster: 200k registered customers, 2k active pandits, 5k bookings/day peak 1.5k/hr, 500 concurrent tracked bookings.
- **DB:** a single Postgres (e.g., 4 vCPU/16 GB) with the indexes in `04` comfortably serves this OLTP; plan a read replica before multi-city.
- **App:** stateless FastAPI behind a load balancer, 2–4 instances × uvicorn workers; move all in-process state to Redis first.
- **Realtime:** 500 concurrent WebSocket tracking sessions is trivial for one node; Redis pub/sub for multi-node.
- **Geo:** PostGIS GiST turns O(n) matching into index lookups — essential past ~a few thousand pandits.
- **"Millions of registered"** ≠ millions concurrent; the registered count is cheap (rows). The real limits are **peak concurrent bookings/dispatch writes** and **GPS write throughput** — both solved by the DB + Redis + queue migration above, validated by load tests.

## Load-testing plan (proposed — not executed)
1. **Dispatch concurrency:** k6/Locust — N pandits racing to accept one booking; assert exactly one confirmed (gates the atomicity fix).
2. **Booking throughput:** ramp booking creates to target peak; measure p95 latency + DB CPU.
3. **GPS write storm:** simulate 500–5000 pandits posting location at the chosen cadence; measure `mp_pandit` write contention.
4. **Webhook burst:** replay duplicate signed webhooks concurrently; assert no double-credit (gates R2).
5. **Read path:** discovery/serviceability at peak with/without cache.
Run against a Postgres staging clone; define SLOs (below) as pass/fail.

## Suggested SLO targets (to validate, not yet met)
API p95 < 300 ms (reads) / < 600 ms (booking create); dispatch offer dispatch < 2 s; tracking freshness < 10 s; webhook processing < 1 s; availability ≥ 99.9%; error rate < 0.5%.
