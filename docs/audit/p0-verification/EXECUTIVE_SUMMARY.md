# P0 Hardening — Independent Verification: Executive Summary

**Branch:** `p0-production-hardening` · **Date:** 2026-11-14
**Mode:** independent, read-only release-gate audit. No code modified, nothing
committed/pushed/merged/deployed, all uncommitted changes preserved.
**Full reports:** this folder (`docs/audit/p0-verification/`).

## Final decision: **SAFE TO MERGE WITH DOCUMENTED CONDITIONS**

The five P0 changes are, with one exception, correctly implemented, safe, and an
improvement over the prior state. Nothing weakens authentication, exposes
secrets/PII, or endangers the money paths — so there is **no hard block**. But a
green build is not readiness: one correctness defect should be fixed before
merge, and several operational prerequisites must be completed and *evidenced*
before P0 is actually "safe to operate" in production.

## What was verified good

- **OTP** — HMAC-SHA256 keyed+phone-bound, constant-time compare, single-use,
  5‑min TTL, attempt cap; **code is never leaked in a production response**; no
  silent weak-key downgrade. **PASS.**
- **RBAC** — enforced at **every** admin/staff endpoint, deny-by-default, roles
  re-resolved from the DB each request, no IDOR. The earlier platform audit's
  "RBAC not enforced" claim is **independently disproven**. **PASS.**
- **Rate limiter** — correct async, pluggable (Redis / Upstash REST / in-process),
  well-isolated keys, and **not** bypassable via spoofed `X-Forwarded-For`.
- **Audit ↔ transaction consistency** — audit rows commit in the *same*
  transaction as the mutation (no internal commits), so a mutation can never
  succeed while its audit fails, nor vice-versa. **No split-brain.**
- **Monitoring & backup tooling** — wiring, script, workflow and runbook are all
  correct by inspection and PII-conservative.
- **Tests** — **51 passed / 6 skipped** and **ruff clean** were independently
  re-run and reproduced.

## The headline finding — A‑1 (MEDIUM, fix before merge)

**The P0 "audit-log coverage gap" was a false premise, and the fix duplicates
existing audit entries.** `finance.create_refund`, `finance.process_payout`, and
`dispatch.manual_reassign` **already** wrote central `audit_log` rows at the
service layer (`finance.py:240/321`, `dispatch.py:599`). The P0 router-level
`audit()` calls add a **second** row per action — with inconsistent `action`
strings (`mp.payment.refund` vs `mp.finance.refund`; `mp.payout.process` vs
`mp.finance.payout`), a conflicting `entity` for payouts, and — for reassign — a
**byte-identical** action string. Result: every refund/payout/reassign now writes
two audit rows into a financial audit trail. The only genuine value the router
version adds is `actor_id` + `ip`, which the service rows lack.

**Fix:** delete the three router `audit()` calls; instead thread `actor_id`/`ip`
into the existing service-layer calls. Correct `docs/P0_HARDENING.md` §4.

## Conditions on the decision

**Before merge (code):** fix A‑1; commit the branch with the required
`Co-Authored-By: Claude Opus 4.8` trailer (nothing is committed yet); re-run the
frontend build.

**Before "safe to operate" (config/dashboard, not code):**
- Rate limiter: provision **Redis/Upstash** (else single-instance only) and
  confirm the real client IP on Vercel (IP limits are unreliable behind the proxy).
- Monitoring: set the **Sentry DSNs** and send one test event — delivery is
  **configured, not verified**.
- Backup/DR: set the **`DATABASE_URL`** secret, **run one backup**, **drill one
  restore**, **enable Supabase PITR**, add **failure alerting**. Today the
  readiness ladder is **A/B done, C–F not done** — the system is *not* yet
  backup-ready.

## Severity ledger

| ID | Area | Severity | One-liner |
|---|---|---|---|
| A‑1 | Audit log | **MEDIUM** | Duplicate audit rows on refund/payout/reassign; false premise. |
| R‑L1 | Rate limit | MEDIUM | Fail-open: Redis/Upstash outage silently disables limiting. |
| R‑L2 | Rate limit | MEDIUM | IP limits unreliable behind Vercel proxy (uses `client.host`, not trusted XFF). |
| DR‑2 | Backup | MEDIUM | No backup-failure notification. |
| DR‑3 | Backup | MEDIUM | GitHub artifacts ≠ encrypted off-site vault for PII/money data. |
| M‑1 | Monitoring | INFO→cond. | Event delivery configured but never verified. |
| M‑2/3/4 | Monitoring | LOW | No beforeSend scrub; sourcemaps served; no global-error handler. |
| R‑L3 | Rate limit | LOW | INCR/EXPIRE not atomic (over-block edge). |
| O‑1..4 | OTP | LOW | Pepper↔JWT coupling; per-row attempt cap; no legacy compat; minimal normalisation. |
| RB‑3/4 | RBAC | LOW | No content delegation (feature); no cross-role denial test. |
| C‑1/2 | Changeset | INFO | Nothing committed; prior-audit docs ride along. |

## Status by area

Changeset **PASS w/cond** · Rate limiter **PASS w/cond** · OTP **PASS** ·
Monitoring **PASS w/cond (delivery NOT VERIFIED)** · RBAC **PASS** ·
Audit log **PASS w/cond** · Backup/DR **PASS w/cond (C–F NOT DONE)** ·
Tests **PASS w/cond**.

See `RELEASE_GATE.md` for the gate detail and `CHANGESET / RATE_LIMITER /
OTP_SECURITY / MONITORING / RBAC / AUDIT_LOG / BACKUP_DR / TEST_EVIDENCE`
reviews for the evidence behind each line.
