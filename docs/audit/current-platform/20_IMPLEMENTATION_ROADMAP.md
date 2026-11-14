# 20 — Implementation Roadmap

Priority-ordered milestones (P0→P6). Each is a bounded, authorizable unit of work. **No work begins without explicit authorization.** Milestone 1/2 (concurrency + integrity + geo backend) are **already done** — this roadmap is what remains.

## P0 — Make it safe to be live (operational)
1. **Backups/DR** — enable Supabase PITR or scheduled dumps + a restore drill. (R-1)
2. **Monitoring** — Sentry (backend+frontend) + uptime pings on `/health/db` + alerting. (R-5)
3. **Distributed rate limiter** — Redis/Upstash-backed; replace in-process. (R-6, S-1)
4. **RBAC enforcement** — gate every sensitive admin/money endpoint server-side + audit log. (R-7, S-3)
5. **Salt/pepper OTP** — HMAC OTP hashing. (R-8, S-2)

## P1 — Make the core transactable
6. **SMS/OTP provider** — integrate (MSG91/Twilio); unblock customer+pandit login. (R-3)
7. **Real payment gateway** — Razorpay/UPI behind the existing provider boundary; idempotency keys + reconciliation. (R-2)
8. **Scheduled-booking dispatch + offer-timeout/re-offer** — needs a worker host + scheduler. (R-4)

## P2 — Infrastructure for scale
9. **Worker + queue host** (Render/Railway/Fly/Cloud Run) — for #8, notifications, payout batching, retries. (AG-2)
10. **Caching layer** — CDN/Redis for catalogue/content. (R-13, PF-1)
11. **Object storage + CDN** — media uploads (replace read-only-FS workaround). (AG-6)

## P3 — Real-time & mobile
12. **Realtime gateway** — WS/SSE or managed (Ably/Pusher) for tracking + offers. (R-12, G-1)
13. **Real device GPS** — replace simulated location + hardcoded base; geocoded onboarding. (R-11, G-2)
14. **Mobile env config + publish** — env-driven base URL; EAS build + store/OTA release. (R-10, AG-8)

## P4 — Admin/CRM depth
15. **Finance reconciliation + payout UI**, invoicing/GST. (F-3, F-5)
16. **Customer CRM** (profiles/history/notes), **Media library**, **SEO engine**, **Homepage builder**. (07 A-2/A-3/A-5)

## P5 — Infra polish & domain
17. **Fix custom domain** `panditjiexpress.com`. (R-9) *(quick win — can pull earlier)*
18. **Secret manager + rotation runbook**, staging environment. (S-5, O-5)

## P6 — Quality & performance
19. **Frontend/mobile E2E tests** (Playwright), **load-test baseline**, **dependency/DAST scan** in CI. (T-1/T-2/T-4/T-5)
20. **Formal WCAG 2.1 AA audit** + fixes. (U-1)

## Sequencing notes
- P0 is cheap and unblocks "safe to operate"; **R-9 (domain)** is a quick win that can run in parallel with P0.
- P1 #8 depends on P2 #9 (worker) — do the worker host first or together.
- Nothing here requires a rewrite (see 18). Recommend authorizing **P0 first** as one milestone, then P1.

**Await explicit authorization before starting any milestone.**
