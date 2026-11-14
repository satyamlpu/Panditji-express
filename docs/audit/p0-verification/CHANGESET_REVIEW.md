# Changeset Review — P0 Production Hardening

**Scope:** independent inspection of the `p0-production-hardening` working tree.
**Method:** read-only `git` inspection + file reads. No code modified, nothing committed.

## Git state (verified)

| Item | Value |
|---|---|
| Current branch | `p0-production-hardening` |
| Branch HEAD | `e674ac5` |
| `main` HEAD | `e674ac5` |
| Merge base | `e674ac5` |
| Commits on branch vs main | **0** (none) |

**Finding C-1 — nothing is committed (INFO).** The branch points at the *same*
commit as `main`. Every P0 change exists only as **uncommitted working-tree
state** (16 modified tracked files + 9 untracked paths). This is consistent with
the "preserve all uncommitted changes" instruction, but it means: there is no
commit to review for message/attribution, and the work is one `git checkout`
away from loss. Recommend committing to the branch (with the required
`Co-Authored-By: Claude Opus 4.8` trailer) once this gate passes, before any
further work.

## Changed files (tracked, `git diff --name-status main`)

```
M backend/api/requirements.txt          +redis, +sentry-sdk
M backend/app/api/routers/auth.py        rate_limit → await
M backend/app/api/routers/public.py      rate_limit → await
M backend/app/core/config.py             +6 settings (redis/upstash/otp_pepper/sentry)
M backend/app/core/ratelimit.py          full rewrite (pluggable async backends)
M backend/app/main.py                    +init_observability()
M backend/app/marketplace/otp.py         sha256 → HMAC, phone-bound
M backend/app/marketplace/routers/admin.py          +audit() on reassign
M backend/app/marketplace/routers/admin_finance.py  +audit() on refund, payout
M backend/app/marketplace/routers/auth.py           rate_limit → await
M backend/app/marketplace/routers/customer.py       rate_limit → await
M backend/requirements.txt               +redis, +sentry-sdk
M backend/tests/conftest.py              ratelimit._buckets.clear() → reset()
M frontend/next.config.ts                +withSentryConfig
M frontend/package-lock.json             +2856/-… (generated — @sentry/nextjs tree)
M frontend/package.json                  +@sentry/nextjs ^8.55.2
```

## New files (untracked)

```
.github/workflows/backup.yml
backend/app/core/observability.py
backend/ops/backup_db.sh
backend/ops/RESTORE_RUNBOOK.md
docs/P0_HARDENING.md
docs/audit/current-platform/01..21_*.md   (prior platform audit — 21 files)
frontend/sentry.server.config.ts
frontend/sentry.edge.config.ts
frontend/src/instrumentation.ts
frontend/src/instrumentation-client.ts
```

## Scope assessment

- **In scope / intended:** every tracked edit and every new file under `backend/`,
  `.github/`, and `frontend/sentry*`/`instrumentation*` maps to one of the five
  P0 items (rate limiter, OTP, monitoring, audit-log, backup/DR). No stray
  refactors, no accidental deletions (`--name-status` shows only `M`, no `D`).
- **Finding C-2 — `docs/audit/current-platform/` (21 files) rides along (INFO).**
  These are the *prior* platform-audit deliverables, not P0 code. Docs-only, no
  risk, but they inflate the untracked set; keep them in their own commit so the
  P0 commit is clean and reviewable.
- **Finding C-3 — `package-lock.json` churn is large but legitimate (INFO).**
  ~2856 inserted lines are the transitive dependency tree of `@sentry/nextjs`
  (generated, not hand-edited). Expected. No unrelated dependency bumps were
  found in `package.json` (single `+@sentry/nextjs` line).
- **Finding C-4 — the audit-log change (#4) does not match its stated rationale.**
  See `AUDIT_LOG_REVIEW.md` (finding A-1). The refund/payout/reassign mutations
  were already writing central `audit_log` rows at the service layer; the P0
  router additions duplicate them. This is the one change whose *intent* (as
  written in `docs/P0_HARDENING.md`) is not borne out by the code.

## Area status: **PASS WITH CONDITIONS**
Scope is clean and limited to P0; no accidental deletions or unrelated edits.
Conditions: commit the work (C-1), isolate the prior-audit docs (C-2), and
resolve the audit-log duplication (C-4 → A-1) before merge.
