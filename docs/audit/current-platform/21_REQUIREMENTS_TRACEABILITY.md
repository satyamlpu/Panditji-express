# 21 — Requirements Traceability & Methodology

## Scoring methodology
Each dimension (01) scored /100 from weighted evidence:
- **Implemented & verified** (code + live/test proof) = full credit.
- **Implemented, not verified live** = partial credit.
- **UI-only / backend-only / not-connected** = low credit.
- **Absent** = zero.
Weights favor the transactional core (auth, booking, dispatch, finance, data integrity) over cosmetic surface. Scores are **judgment calibrated to evidence**, not a measured metric; they rank readiness, they are not SLAs.

### Score rationale (summary)
| Dimension | Score | Why |
|---|---|---|
| Product completeness | 58 | core built; OTP/payments/scheduled-dispatch/mobile-publish incomplete |
| Frontend | 68 | website live + redesigned; booking blocked at OTP; no FE tests |
| Backend | 80 | hardened, live, tested; gaps: rate limiter, OTP delivery, mock pay |
| Database | 78 | migration-backed invariants + indexes; no backups |
| Security | 74 | strong fundamentals; residual limiter/OTP-hash/RBAC |
| Testing | 55 | excellent backend risk-path coverage; no FE/mobile/load/security |
| DevOps | 42 | deployed but no monitoring/backups/worker; domain broken |
| Scalability | 40 | horizontally-friendly design but **nothing measured**, no cache/queue/push |

## Expected-feature → state traceability
| Marketplace requirement | State | Report |
|---|---|---|
| Service discovery & content | ✅ | 03, 04 |
| Customer account/login | ⛔ (no SMS) | 05 |
| Pandit account/login + onboarding | ⛔ / 🟡 demo loc | 06 |
| On-demand booking + dispatch | ✅ | 10 |
| Scheduled booking dispatch | ❌ | 10 DP-1 |
| Atomic accept (no double-book) | ✅ verified | 10 |
| Payments (real) | ❌ mock | 11 |
| Ledger/refund/payout | ✅ verified | 11 |
| Live tracking (real GPS + realtime) | 🟡 simulated/polling | 12 |
| Reviews/ratings | ✅ | 03 |
| Admin CMS | ✅ | 07 |
| Admin CRM depth | 🟡 | 07 |
| RBAC enforcement | 🟡 | 07, 13 |
| Notifications (push/SMS/email) | ❌ | 03, 05, 08 |
| Backups/monitoring | ❌ | 14 |
| Mobile apps published | ❌ | 05, 06 |
| CI | ✅ | 14, 15 |

## Audit integrity statement
- **Read-only**: no application code, schema, migration, env, config, branch, commit, deploy, or production data was modified. Only files under `docs/audit/current-platform/` were created.
- **Evidence-based**: findings cite file paths / endpoints / migrations inspected this pass. Where a fact is from the prior session (e.g. live `/health/db`, test pass counts, Supabase seed), it is **labelled as restated, not re-measured**.
- **No fabrication**: nothing claims a file, API, test result, or infrastructure that was not observed. Items not checked are marked **NOT VERIFIED**.
- **No secrets/PII** are reproduced in any report.

## Report index
01 Executive Summary · 02 Repository Inventory · 03 Feature Matrix · 04 Website · 05 Customer App · 06 Pandit App · 07 Admin CMS/CRM · 08 Backend API · 09 Database · 10 Booking/Dispatch · 11 Payment/Financial · 12 GPS/Realtime · 13 Security · 14 DevOps/Infra · 15 Testing/QA · 16 UI/UX/A11y · 17 Performance/Scalability · 18 Architecture Gap · 19 Risk Register · 20 Roadmap · 21 Traceability (this doc).
