# 19 — Risk Register

Ranked by business exposure. L=Likelihood, I=Impact (both H/M/L). Severity = overall.

| ID | Risk | L | I | Severity | Source | Mitigation |
|---|---|---|---|---|---|---|
| R-1 | **No backups/PITR** on money-bearing DB → irrecoverable data loss | M | H | **CRITICAL** | 09 D-1, 14 O-2 | Enable Supabase PITR / scheduled dumps + restore drill |
| R-2 | **Mock payments** → cannot take real money; if wired carelessly, financial errors | H | H | **CRITICAL** | 11 F-1 | Integrate real gateway with idempotency + reconciliation before go-live |
| R-3 | **OTP login blocked** (no SMS) → no customer/pandit can transact | H | H | **CRITICAL** | 03, 05 C-2, 06 P-2 | Integrate SMS provider; salt/pepper OTP (R-8) in same change |
| R-4 | **Scheduled bookings silently never dispatched** → missed pujas, reputational | M | H | **HIGH** | 10 DP-1 | Add worker + scheduler; offer-timeout/re-offer |
| R-5 | **No monitoring/alerting** → outages & money bugs go unseen | H | M | **HIGH** | 14 O-1 | Sentry + uptime pings on `/health/db` |
| R-6 | **In-process rate limiter** → brute-force/OTP-flood at scale | M | H | **HIGH** | 08 B-1, 13 S-1 | Redis-backed limiter |
| R-7 | **RBAC not enforced server-side** → staff privilege escalation | M | H | **HIGH** | 07 A-1, 13 S-3 | Gate every sensitive endpoint + audit log |
| R-8 | **Unsalted SHA-256 OTP** → rainbow-table if store leaks | L | M | **MEDIUM** | 13 S-2 | Salt+pepper / HMAC with server secret |
| R-9 | **Custom domain empty** → public can't reach the product | H | M | **MEDIUM** | 14 O-3 | Fix DNS/Vercel domain binding |
| R-10 | **Mobile apps hardcode localhost + unpublished** → unusable in prod | H | M | **MEDIUM** | 05 C-1, 06 P-1/P-5 | Env config + EAS build/publish |
| R-11 | **Simulated GPS / hardcoded base location** → "live tracking" is fake | H | M | **MEDIUM** | 12 G-2 | Real device GPS + geocoded onboarding |
| R-12 | **No realtime transport** → poor tracking UX, server/battery cost at scale | M | M | **MEDIUM** | 12 G-1 | WS/SSE or managed realtime |
| R-13 | **No caching layer** → DB hot path under load | M | M | **MEDIUM** | 17 PF-1 | CDN/Redis cache for catalogue/content |
| R-14 | **No frontend/mobile/load/security tests** → regressions ship unnoticed | M | M | **MEDIUM** | 15 T-1/T-2/T-4 | Add E2E + load + CVE scan to CI |
| R-15 | **SQLite dev false-green** on concurrency/geo | M | L | **LOW** | 15 T-3 | Default dev to Postgres or warn loudly |
| R-16 | **No tax/GST/invoicing** | M | L | **LOW** | 11 F-5 | Add before financial compliance deadline |
| R-17 | **Accessibility: no formal AA audit; saffron contrast** | M | L | **LOW** | 16 U-1/U-2 | axe/Lighthouse pass; keep saffron non-text |
| R-18 | **No secret rotation / secret manager** | L | M | **LOW** | 13 S-5 | Rotation runbook + manager |

## Top 6 go-live blockers (P0)
R-1 backups · R-2 real payments · R-3 SMS/OTP · R-5 monitoring · R-6 rate limiter · R-7 RBAC. (R-4 scheduled dispatch and R-9 domain are fast-follows.)
