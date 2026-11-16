# 18 — Architecture Gap Analysis

## Current architecture (as-is)
```
[Website + Admin: Next.js on Vercel] ──BFF──┐
[Customer app: Expo]  (localhost base URL)  │
[Pandit app: Expo]    (localhost base URL)  ├──► [FastAPI on Vercel] ──► [Supabase Postgres]
                                            │         (stateless, NullPool)
                                            └── mock payments / HMAC webhook
```
Monolithic FastAPI (well-modularized), serverless functions, single Postgres. No cache, no queue/worker, no realtime gateway, no object storage, no monitoring.

## Target architecture (to-be, minimal viable production)
```
[Clients] ─► [FastAPI (Vercel or container)] ─► [Postgres + PITR]
                 │   ├─► [Redis/Upstash]  (rate limit, cache, presence)
                 │   ├─► [Queue + Worker]  (scheduled dispatch, offer-timeout, notifications, payouts)
                 │   ├─► [Realtime gateway] (WS/SSE or Ably/Pusher) for tracking + offers
                 │   ├─► [Object storage + CDN] (media)
                 │   └─► [Real payment gateway] (idempotent, reconciled)
             [Monitoring/error tracking/uptime] + [SMS/push provider]
```

## Gaps (as-is → to-be)
| # | Gap | Impact | Fix class |
|---|---|---|---|
| AG-1 | No shared state store (Redis) | rate-limit correctness, no cache/presence | add Upstash/Redis |
| AG-2 | No queue + worker host | scheduled dispatch & async jobs impossible on Vercel | add worker (Render/Railway/Fly/Cloud Run) + queue |
| AG-3 | No realtime transport | polling-only tracking/offers | WS/SSE or managed realtime |
| AG-4 | No SMS/push provider | OTP login + notifications blocked | integrate provider (MSG91/Twilio/FCM) |
| AG-5 | Mock payments | cannot transact | integrate Razorpay/UPI + idempotency + reconciliation |
| AG-6 | No object storage/CDN | media/uploads unsupported on read-only FS | S3/Supabase Storage + CDN |
| AG-7 | No monitoring/backups | blind + unrecoverable | Sentry + uptime + Postgres PITR |
| AG-8 | Mobile base URL hardcoded + not published | apps unusable in prod | env config + EAS build/publish |
| AG-9 | RBAC not enforced server-side | privilege risk | gate endpoints + audit |

## Key decision: **do not rewrite**
The FastAPI modular monolith + Supabase is the right core. Every gap above is **additive** (a new dependency or a bounded code change), not a re-architecture. The worker host (AG-2) is the one piece that may move the backend off pure-serverless — recommend a small always-on container alongside Vercel, or move the API to a container host and keep Vercel for the frontend.

## Classification
Architecture: **SOUND core, INCOMPLETE periphery.** No structural redesign required; execute the gap list in roadmap priority order (20).
