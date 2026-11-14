# Backup & Disaster-Recovery Review

**Files:** `backend/ops/backup_db.sh`, `backend/ops/RESTORE_RUNBOOK.md`,
`.github/workflows/backup.yml`.

## Readiness ladder (the honest distinction)

| | State | Verdict | Evidence |
|---|---|---|---|
| A | Backup **script** exists | ✅ YES | `backup_db.sh` read & reviewed |
| B | **Scheduled workflow** exists | ✅ YES | `backup.yml`, daily cron |
| C | A backup has **actually completed** | ❌ **NO / NOT VERIFIED** | never run; needs `DATABASE_URL` secret; cron not yet fired; not run against prod in this audit |
| D | Backup **integrity verified** | ❌ NO | script has `pg_restore --list`, but no run has occurred |
| E | **Restore successfully tested** | ❌ NO | runbook drill procedure present; drill log empty |
| F | **Supabase PITR enabled** | ❌ NO / UNKNOWN | dashboard action; runbook checkboxes unchecked |

**Backup readiness = A + B only (tooling in place). C–F are operational
prerequisites that remain outstanding. This is NOT backup-ready.**

## Script review — `backup_db.sh` (verified)

- `set -euo pipefail`; requires `DATABASE_URL` (exit 2 if unset); requires
  `pg_dump` on PATH (exit 3 if missing). Good defensive guards.
- **URL normalisation:** strips `postgresql+psycopg://`, `+asyncpg://`, and
  `postgres://` → `postgresql://` so the app's SQLAlchemy URL works with libpq.
  Correct.
- **Dump:** `pg_dump -Fc --no-owner --no-privileges` — custom format, portable,
  selectively restorable. Correct for Supabase.
- **Integrity check:** `pg_restore --list "$FILE" >/dev/null` parses the archive
  after dump. Good (catches a truncated/corrupt archive).
- **Retention:** keeps newest `RETENTION` (default 14), prunes the rest. Correct.

### DR‑1 — client/server major-version coupling (LOW)
`pg_dump` must match the Supabase server major version. The workflow pins
`postgresql-client-16`; if the Supabase instance is PG15/17 the dump can fail or
warn. Confirm the server version and pin accordingly.

## Workflow review — `backup.yml` (verified)

- Trigger: `schedule: cron "17 2 * * *"` (02:17 UTC daily) + `workflow_dispatch`.
- `concurrency: db-backup`, `cancel-in-progress:false` — no overlapping runs.
- Installs `postgresql-client-16` from the PGDG apt repo.
- Runs the script with `DATABASE_URL: ${{ secrets.DATABASE_URL }}`; explicitly
  fails (`::error::`) if the secret is empty.
- Uploads `backups/*.dump` as an artifact, `retention-days:14`,
  `if-no-files-found:error`.
- Default job permissions (no `permissions:` block → read-only `GITHUB_TOKEN`);
  no excess scope. OK.

### DR‑2 — no failure notification (MEDIUM)
The workflow has **no on-failure alert** (no Slack/email/issue/PagerDuty). A
silently failing nightly backup is the classic DR trap — you discover it only
when you need a restore. 
- **Recommendation:** add a failure notification step (and ideally a success
  heartbeat), or a scheduled "last successful backup age" check.

### DR‑3 — GitHub artifacts are not a true off-site encrypted vault (MEDIUM)
The workflow itself acknowledges this. Artifacts are retention-limited (14d),
accessible to repo collaborators, and encrypted with GitHub-managed keys — the
dump contains full customer PII + money data.
- **Recommendation:** for production, push to object storage (S3/GCS) with
  server-side (ideally customer-managed) encryption, lifecycle policy, and
  least-privilege access, as the file comments already note.

### DR‑4 — encryption in transit (INFO)
`pg_dump` over the Supabase connection should use TLS. Ensure `DATABASE_URL`
carries `sslmode=require` (Supabase defaults to TLS; confirm the secret's URL).

## Runbook review — `RESTORE_RUNBOOK.md` (verified)

- Two layers correctly distinguished: **Layer 1 Supabase PITR (primary, manual
  dashboard action — explicitly flagged "Claude cannot enable this")** and
  **Layer 2 logical dumps (scripted, off-provider)**.
- Restore drill is sound: restore into a **scratch** DB (never over prod first),
  verify money-table row counts + newest rows + constraints, app smoke test via
  `/health/db`, record real RTO, tear down.
- Proposed targets: **RPO ≤ 5 min (PITR), RTO ≤ 1 h** — marked "confirm with the
  business" (honest — not asserted as achieved).
- Uses the Supabase **session pooler / direct** URL for dumps, not the `:6543`
  transaction pooler. Correct.
- Drill log table is **empty** → confirms E (restore tested) = NO.

## Area status: **PASS WITH CONDITIONS**
Tooling (script + workflow + runbook) is correct and production-shaped.
Conditions before this counts as DR-ready: set the `DATABASE_URL` secret and let
one backup complete (C), verify integrity (D), run the first restore drill (E),
enable Supabase PITR (F), add failure alerting (DR‑2), and move archives to an
encrypted off-site vault (DR‑3). **Do not claim backup readiness on the strength
of the script existing.**
