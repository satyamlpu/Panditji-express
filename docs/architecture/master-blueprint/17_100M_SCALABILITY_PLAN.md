# 17 — 100M-User Scalability Plan

> **100M registered users is a strategic target, NOT verified current capacity.** No
> claim of present scale is made. Every number below is a **capacity model or target**
> and must be confirmed by load tests (see 19) before being asserted. The current system
> has run no load test.

## Guiding principle (rule #14)
Stay a **modular monolith**; scale it out horizontally first. Extract a service only when
**measured evidence** (a specific hot module, a specific bottleneck) justifies it.

## Staged scaling ladder
| Stage | Users (registered) | Shape |
|---|---|---|
| S0 (now) | launch / UP pilot | Vercel serverless API + Supabase, no cache/queue |
| S1 | ~10^5–10^6 | + Redis (rate-limit/cache/presence) + queue/worker + object storage + Sentry/alerting |
| S2 | ~10^6–10^7 | + read replicas + table partitioning + CDN tuning + realtime channel + search |
| S3 | ~10^7–10^8 | + regional resilience + DB sharding **only if proven** + dedicated services for hottest modules (dispatch, tracking, notifications) |

## Component plan
| Component | Current | Target (staged) |
|---|---|---|
| API horizontal scale | serverless auto | keep; move hot/background to container workers (S1) |
| CDN | Vercel edge | tune cache keys; static/media on CDN (S1) |
| DB connection pooling | Supabase pooler + NullPool | PgBouncer sizing; replicas (S2) |
| Redis | [MISSING] | rate-limit, cache, locks, presence geo-set (S1) |
| Durable queue | [MISSING] | outbox/dispatch/retries (S1) |
| Workers | [MISSING] | scheduled dispatch, notifications, reconciliation (S1) |
| Postgres optimization | indexes + PostGIS | query tuning, composite indexes, VACUUM/autovacuum tuning (S1–S2) |
| Read replicas | [MISSING] | route reads (lists/analytics) to replica (S2) |
| Partitioning | [MISSING] | range-by-time on events/tracking/ledger/notifications (S2) |
| Search | [MISSING] | Postgres FTS → dedicated (Meilisearch/OpenSearch) if needed (S2) |
| Object storage | [MISSING] | KYC/media + signed URLs (S1) |
| Realtime | poll | Supabase Realtime / WS (S2) |
| Notification throughput | in-DB only | provider + worker fan-out (S1) |
| Regional resilience / DR | single region | multi-AZ → multi-region as warranted (S3) |

## Capacity model (ILLUSTRATIVE — assumptions stated, NOT measured)
Assume 100M registered, **MAU ≈ 8%** (8M), **DAU ≈ 1.5%** (1.5M), peak-concurrent ≈ 2%
of DAU (~30k). These are **planning assumptions** to validate, not facts.

| Dimension | Illustrative model | Note |
|---|---|---|
| Registered | 100M | storage: profiles small; media/docs dominate |
| MAU / DAU | ~8M / ~1.5M | drives read load |
| Peak concurrent | ~30k | sizing for API/Redis/DB connections |
| Requests/sec (peak) | model from DAU×actions/session÷peak-window | **run load test** |
| Booking txns/day | business-driven | ledger write rate = bookings × ~5 entries |
| GPS updates | active-jobs × (1 ping / 5–15s) | **dominant write** → Redis + partitioned batch |
| OTP traffic | logins + signups × retries | SMS provider rate caps + cost |
| Queue throughput | notifications + dispatch + outbox | size workers to peak |
| Storage growth | KYC docs + media + events/tracking retention | object store + retention policy |

Every cell marked "model"/"business-driven" is **[NEEDS-VALIDATION]** by load/soak tests
and real traffic before any capacity claim.

## SLOs / RPO / RTO (targets — see 18/20)
- Availability target (API) and latency SLOs defined in 18.
- **RPO ≤ 5 min** (via Supabase PITR once enabled), **RTO ≤ 1 h** (restore drill) —
  targets, not yet demonstrated (20).

## What NOT to do yet
- No sharding, no microservice split, no multi-region — none justified by measured load.
  Premature distribution adds failure modes. Revisit at S2/S3 with evidence.
