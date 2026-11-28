# Production-Readiness Report — Consolidated CRM Release

Scope: the consolidated branch (local `feat/crm-plus-release`, to be pushed as
`feat/crm-consolidated`) combining **#11** (backend release) + CRM **Modules 01, 02,
03, 05, 06, 07, 08** on top of current `main` (which already has #16, #22/Module 04,
#29). **Target single Alembic head: `de1035e6959b`.** Nothing merged or deployed.

## 1. PR status
- **Blocked by a local network outage** at report time (GitHub unreachable from the
  agent host). The branch is built, committed, and verified locally; an **auto-push
  to `feat/crm-consolidated`** is armed and fires on reconnect, after which the PR is
  opened.
- Force-updating the existing PR **#28** branch was blocked by safety policy
  (history rewrite); the consolidated work therefore lands as a **new PR**. To make
  it literally #28, a maintainer allows a force-push or uses the new PR and closes
  the old ones.
- **Supersedes (close after merge):** #11, #18, #20, #21, #23, #24, #25, #26 (and
  the earlier combined PRs #27/#28). Keep #29 (merged). #17 (docs) is independent.
  #19 (mock-OTP testing env) intentionally excluded.

## 2. CI results (local CI-parity; GitHub CI pending push)
| Check | Result |
|-------|--------|
| Backend pytest — **PostgreSQL** | **154 passed / 2 skipped** (the 2 are PostGIS tests; skip only because PostGIS isn't installed on the agent host — they run on CI) |
| Backend pytest — SQLite | 150 passed / 6 skipped |
| `ruff` | clean |
| Frontend `tsc` / `next lint` / `next build` | clean · clean · **52 pages** |
| Fixed | #27's sole backend failure (`test_system_health` hardcoded `dialect=="sqlite"`) now matches the actual DB |

## 3. Migration verification
- **Single head: `de1035e6959b`** (new merge revision unifying #11's RLS
  `e7a1b2c3d4f5` + Service-Areas `f1a2b3c4d5e6`). Confirmed via `alembic heads`.
- **Reversibility:** `alembic upgrade head` + `downgrade base` succeed on SQLite.
- **Schema on PostgreSQL:** the full model set (incl. `mp_service_area`, app_release,
  push_tokens) validated by the Postgres pytest run (`create_all`).
- **No table collision:** #11's `c4d1e2f3a5b6` media migration is a no-op (resolve-pr11
  neutered it); #16's `d4f7b1a9c2e8` owns the media schema.
- **Prod SQL prepared:** `PROD-MIGRATE-c3e6a9f1d4b7-to-de1035e6959b.sql` — one atomic
  transaction, self-abort guard, no PostGIS DDL (that was `c3e6a9f1d4b7`, already on
  prod). ⚠️ A **PostGIS staging dry-run was not possible locally** (no PostGIS); CI's
  PostGIS job will exercise the full chain.

## 4. API health (consolidated backend, local)
- **All 15 admin/module endpoints return 200** (dashboard, analytics, customers,
  partners, ops, audit, finance summary + reconciliation, support metrics, system
  health, service-areas, staff, app-releases, reviews, bookings).
- **End-to-end lifecycle passed:** customer OTP → booking → dispatch → partner OTP →
  accept → en_route/arrived/in_progress/completed → **payment + ledger** →
  **notifications** (payment/completed/in_progress/arrived/en_route) → review → admin
  partner approval.

## 5. Security checks
- **RBAC enforced:** a finance-role staffer gets `/finance` 200 but `/customers`,
  `/audit`, `/service-areas` 403. Audit viewer + System Health are super-admin only.
- **Dev payment endpoint gated:** `/mp/payments/mock/pay` returns 403 when
  `APP_ENV=production`.
- **No mock/placeholder/simulated data** in production-facing CRM code — every module
  queries the real DB; audit viewer reads the real `audit_log`; analytics is real
  booking data. (Hits in the scan were the dev gateway, a timing-attack dummy hash,
  and UI placeholders — all legitimate.)
- **Secret-safe System Health** (names/booleans only; asserted by test).
- **#11 adds** Supabase Data-API lockdown + RLS, Razorpay signature verification,
  MSG91 OTP, push-token registry.

## 6. Remaining blockers / required human actions
1. **Network/push** (transient) — auto-push armed; PR + GitHub CI pending reconnect.
2. **Approval-gated, needs prod credentials (not done):**
   - Run the prod migration `c3e6a9f1d4b7 → de1035e6959b` (backup first).
   - Set prod env: owner-role `DATABASE_URL`, `PAYMENT_PROVIDER=razorpay` + keys,
     `SMS_PROVIDER=msg91` + creds, Supabase media vars, strong secrets (see the
     deployment runbook §0).
   - Merge the PR + redeploy (keep #29's Pillow fix).
3. **Product decisions (not hardcoded):** serviceability enforcement, commission %,
   payout cycle, cancellation charges, KYC policy, tax/GST.
4. **PostGIS staging dry-run** of the migration — recommended on a real staging DB
   with PostGIS before prod.

See [`CONSOLIDATED-RELEASE-DEPLOYMENT.md`](./CONSOLIDATED-RELEASE-DEPLOYMENT.md) for
the backup/migration/rollback/sequence/checklist.
