# 18 — Open Decisions & Unverified Assumptions

## A. Open business / product decisions (need stakeholder input)
1. **Payment provider** — Razorpay vs Cashfree vs PayU vs Stripe (India). Drives the webhook/refund/payout adapter and settlement model. (The code is provider-agnostic behind the mock.)
2. **SMS + Push providers** — OTP SMS (MSG91/Gupshup/Twilio?) and push (Expo Push vs FCM/APNs direct). Cost + deliverability + DLT (India SMS regulation) matter.
3. **Hosting target** — backend (Render/Railway/Fly/AWS ECS/GCP Cloud Run?) + managed Postgres(+PostGIS) + managed Redis; frontend (Vercel?). Affects CI/CD and IaC.
4. **Object storage + CDN** — S3+CloudFront / GCS+Cloud CDN / Cloudflare R2.
5. **Realtime transport** — self-hosted WebSocket vs managed (Ably/Pusher/Supabase Realtime). Cost vs ops.
6. **Maps/routing** — straight-line ETA (free, current) vs Google/Mapbox routing (road ETA, cost).
7. **Launch scope** — single city first (UP) vs multi-city from day one (affects geo/multi-tenancy, serviceability model).
8. **Scheduled-booking policy** — lead time, cancellation/refund windows, pandit slot granularity, no-show handling.
9. **Commission model** — flat 15% (current) vs per-service/tiered; GST/tax handling on commission and payouts.
10. **Data retention & privacy** — GPS retention, PII access policy, right-to-erasure (India DPDP Act 2023 compliance) — currently undocumented.
11. **KYC/verification** — manual (current) vs an automated KYC provider; document types required.
12. **Governance roles** — exact role → permission matrix for the 8 proposed roles.

## B. Open technical decisions
1. **Backend language** — this audit recommends **keeping FastAPI** (not rewriting to TS). Needs explicit sign-off to close the proposed-stack divergence.
2. **Job queue** — arq (asyncio-native, Redis) vs Celery vs RQ. (arq fits the async FastAPI stack best.)
3. **Dispatch concurrency mechanism** — `SELECT … FOR UPDATE` vs advisory locks vs a unique accepted-attempt constraint (recommend: constraint **and** row lock, belt-and-braces).
4. **Scheduling model** — slot table granularity; whether a pandit can hold overlapping tentative offers.
5. **Analytics** — on the OLTP replica vs a separate warehouse (defer warehouse until measured need).
6. **Multi-tenancy / city scoping** — add a `city`/region column + row scoping now vs later.
7. **Test DB in CI** — ephemeral Postgres service container (recommended) + PostGIS image.
8. **Git** — initialize a single repo at the project root (currently none); branching/release strategy.

## C. Unverified assumptions (could not confirm within read-only scope)
1. Live `panditji.db` schema matches the Alembic head (did not query `alembic_version`/`.schema`).
2. Test suite pass/fail — **not executed** (would write to the test DB). Run `pytest` in CI to confirm.
3. Dependency CVEs — no `pip-audit`/`npm audit` run. Run in CI.
4. Runtime Postgres behavior — psycopg uninstalled; PG + PostGIS not exercised.
5. Mobile device-GPS/permission configuration — not confirmed in `app.json`/config plugins.
6. "Millions of users" capacity — **no load testing**; all scale statements are architectural, not measured.
7. Real payment-gateway behavior — only the mock path exercised.
8. Whether any composite index exists in the live DB but not in code/migrations (code shows none).
9. Production `.env` contents — only dev placeholders were present; real prod secrets (and whether any default is left unchanged) are unverified.

## D. What this audit did NOT do (by restriction)
No code/DB/config/git changes; no migrations/seeds/writes; no deploys; no external scans or penetration testing; no reading of real customer/pandit PII or location history; no secret values printed. The only artifacts created are these `docs/audit/*.md` reports.
