# Release Gate — P0 Production Hardening

**Branch:** `p0-production-hardening` (uncommitted; HEAD = `main` = `e674ac5`)
**Date:** 2026-11-14 · **Mode:** independent, read-only verification.
**A successful build alone is not sufficient** — this gate weighs code
correctness, security, data integrity, operational readiness, and evidence.

## Area statuses

| Area | Status | Why |
|---|---|---|
| Changeset | **PASS WITH CONDITIONS** | Scope clean, no accidental deletions; nothing committed (C‑1); #4 doesn't match its rationale (→ A‑1). |
| Rate limiter | **PASS WITH CONDITIONS** | Correct async + spoof-resistant; fail-open by design (R‑L1), proxy-IP granularity (R‑L2), needs a shared store in prod. |
| OTP | **PASS** | HMAC + phone binding + constant-time; no prod code leak; no weak-key downgrade. Minor hardening only. |
| Monitoring | **PASS WITH CONDITIONS** · delivery **NOT VERIFIED** | Wiring correct & PII-safe, but no event ever delivered (M‑1); add scrubbing/sourcemap hygiene (M‑2/M‑3). |
| RBAC | **PASS** | Enforced per-endpoint, deny-by-default, DB-resolved roles, no IDOR. Earlier "not enforced" claim disproven. |
| Audit log | **PASS WITH CONDITIONS** | Atomic with the mutation (no split-brain) — but P0 adds **duplicate** rows on refund/payout/reassign on a false premise (A‑1). |
| Backup / DR | **PASS WITH CONDITIONS** | Script + workflow + runbook correct (A,B); **no backup has run, no restore drilled, PITR not enabled** (C–F); no failure alert (DR‑2). |
| Test evidence | **PASS WITH CONDITIONS** | 51/6 + ruff re-verified; frontend build not re-run; PG concurrency tests not run; key P0 behaviours lack assertions. |

## Blocking vs non-blocking

**No finding is a safety regression or data-loss risk.** The changes do not
weaken auth, do not expose secrets/PII, and do not endanger the money paths.
Nothing here forces a hard **BLOCK**.

**Should be fixed before merge (correctness / integrity):**
1. **A‑1 — audit duplication.** Remove the 3 router-level `audit()` calls; enrich
   the existing service-layer calls with `actor_id` + `ip` instead. Correct
   `docs/P0_HARDENING.md` §4. *(1 defect that writes wrong data into a financial
   audit trail — cheap to fix, worth fixing before it ships.)*
2. **C‑1 — commit the work** to the branch with the required
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer, keeping the
   prior-audit docs (C‑2) in a separate commit.
3. Re-run the **frontend build** in the pipeline.

**Operational prerequisites before P0 is actually "safe to operate" in prod
(config/dashboard, not code):**
- Provision **Redis/Upstash** and set `REDIS_URL` or the Upstash pair (else the
  limiter is single-instance only — R‑L1); confirm the real client IP source on
  Vercel (R‑L2).
- Create a **Sentry** project; set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`; send
  one test event to verify delivery (M‑1).
- Set the GitHub **`DATABASE_URL`** secret; let one backup run and verify it
  (C/D); run the first **restore drill** (E); enable **Supabase PITR** (F); add
  backup **failure alerting** (DR‑2).
- (Recommended) set a dedicated **`OTP_PEPPER`** (O‑1).

**Fast-follow hardening (not gating):** R‑L3 atomic INCR/EXPIRE, M‑2 beforeSend
scrub, M‑3 sourcemap deletion, M‑4 global-error handler, assertion tests for
audit/OTP/rate-limit/cross-role (TEST_EVIDENCE).

## FINAL DECISION

### SAFE TO MERGE WITH DOCUMENTED CONDITIONS

The P0 code is sound and safe to merge **once A‑1 (audit duplication) is fixed and
the rationale corrected**, the work is committed with the required attribution,
and the frontend build is re-run green. Merging the code does **not** by itself
make the platform "safe to operate": the operational prerequisites above
(shared rate-limit store, Sentry DSN + delivery check, backup secret + completed
backup + restore drill + PITR) must be completed and evidenced before P0 is
considered live. Until a backup has actually run and a restore has been drilled,
**backup readiness remains C–F = NOT DONE**, regardless of merge state.

No code was modified, nothing was committed, pushed, merged or deployed, and all
uncommitted changes are preserved. Awaiting explicit authorization for any
remediation or merge.
