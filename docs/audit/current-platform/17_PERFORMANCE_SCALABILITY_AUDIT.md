# 17 — Performance & Scalability Audit

> **No load tests or Lighthouse runs were performed.** This report is a source-and-architecture assessment. Any number below is a design observation, **not a measurement**. No "millions of users" claim is made or supported.

## Current scaling properties (verified from config)
| Property | State | Evidence |
|---|---|---|
| Stateless API | ✅ | Vercel functions, JWT (no server session) |
| Serverless DB pooling | ✅ | NullPool + `prepare_threshold=None`; Supabase transaction pooler (:6543) | `db/session.py` |
| Query indexing | ✅ | composite indexes on dispatch/payment/ledger/pandit; PostGIS GiST available | 09 |
| Read scaling | 🟡 | relies on Supabase Postgres; no read replicas / caching layer |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| **PF-1** | **HIGH** | **No caching layer** (Redis/CDN edge cache for catalogue/content) — every discovery/content hit goes to Postgres | no cache in repo |
| **PF-2** | **HIGH** | **In-process rate limiter + no shared state store** — blocks horizontal correctness (rate limits, future dispatch coordination) | 08 B-1, 13 S-1 |
| PF-3 | HIGH | **No background worker/queue** — scheduled dispatch, notifications, payouts batching, retries have nowhere to run | 10 DP-1, 14 O-4 |
| PF-4 | MEDIUM | Supabase transaction pooler caps prepared statements / connection semantics — fine now, must size with traffic | `db/session.py` |
| PF-5 | MEDIUM | Polling-based tracking/offers scale poorly (O(clients) HTTP) vs. a push channel | 12 G-1 |
| PF-6 | MEDIUM | No pagination audit — confirm all list endpoints paginate before large data | routers |
| PF-7 | LOW | No image CDN / WebP pipeline for media | 14 O-8 |
| PF-8 | INFO | **Scale-readiness unmeasured** — needs a load-test baseline before any capacity claim | this report |

## Strengths
The architecture is **horizontally friendly** (stateless, serverless, pooled, indexed). The gaps (cache, shared store, worker, push) are **additive infrastructure**, not rewrites — the data model and query paths are already indexed for growth.

## Classification
Scalability: **FOUNDATION-READY, INFRA-INCOMPLETE.** Design is sound for scale; the enabling pieces (Redis/cache, queue/worker, push, load-test baseline) are **not yet present**. Scalability readiness scored **40/100** precisely because nothing has been measured.
