# Backup & Disaster-Recovery Runbook

Pandit Ji Express stores bookings, payments, ledger entries and payouts — a money
system. Loss or corruption must be recoverable. This runbook covers the two
layers and a quarterly restore drill.

> **Targets (proposed, confirm with the business):** RPO ≤ 5 min (PITR),
> RTO ≤ 1 hour. Logical dumps give a coarser RPO (their schedule) but an
> off-provider copy.

## Layer 1 — Supabase PITR (primary) — **MANUAL, dashboard action**
Point-in-time recovery is the primary mechanism and is enabled in the Supabase
dashboard, not from this repo. **Claude cannot enable this — it requires
dashboard access and a plan that includes PITR.**

1. Supabase → Project → **Database → Backups**.
2. Enable **Point-in-Time Recovery** (Pro plan or higher). Note the retention
   window (e.g. 7 days).
3. Confirm **daily backups** are on.
4. Record the enablement date + retention window below.

| Setting | Value | Confirmed on |
|---|---|---|
| PITR enabled | ☐ | |
| Retention window | | |
| Daily backups | ☐ | |

## Layer 2 — Logical dumps (off-provider, portable) — **scripted**
`ops/backup_db.sh` produces timestamped `pg_dump -Fc` archives and prunes to a
retention count. Run it from a scheduler against `DATABASE_URL`.

Local / manual:
```bash
DATABASE_URL="postgresql://...:6543/postgres" RETENTION=14 \
  backend/ops/backup_db.sh /secure/backup/location
```

Scheduled (GitHub Actions): see `.github/workflows/backup.yml` — a daily cron
that runs the script with the DB URL from the `DATABASE_URL` secret and uploads
the archive as an encrypted artifact / to object storage. **Do not** commit
dumps to git.

> Use the Supabase **session pooler / direct** connection for `pg_dump` (the
> transaction pooler on :6543 does not support all dump operations). Match the
> client major version to the server.

## Restore drill (run quarterly, and before any risky migration)
Never restore over production first — restore into a scratch database, verify,
then cut over.

1. **Provision a scratch DB** (a new Supabase project, or local Postgres).
2. **Restore** the latest logical dump:
   ```bash
   createdb panditji_restore_test   # or create a scratch Supabase project
   pg_restore --no-owner --no-privileges \
     --dbname="postgresql://.../panditji_restore_test" \
     backend/ops/backups/panditji_<STAMP>.dump
   ```
3. **Verify integrity** — row counts and newest rows for the money tables:
   ```sql
   SELECT 'payments' t, count(*), max(created_at) FROM payments
   UNION ALL SELECT 'ledger_entries', count(*), max(created_at) FROM ledger_entries
   UNION ALL SELECT 'bookings', count(*), max(created_at) FROM bookings;
   ```
   Compare against production. Confirm the partial-unique and CHECK constraints
   are present (`\d+ payments`, `\d+ dispatch_offers`).
4. **App smoke test** — point a staging app at the restored DB; hit
   `/health/db`, list services, read a booking.
5. **Record** the drill date, dump timestamp, restore duration (your real RTO)
   and any issues in the log below.
6. **Tear down** the scratch DB.

### For a real PITR recovery
Supabase → Database → Backups → **Restore** → pick the timestamp (just before the
incident). Supabase provisions a recovered instance; update `DATABASE_URL` env in
both Vercel projects to the recovered connection string, redeploy, verify
`/health/db`.

## Drill log
| Date | Dump / PITR point | RTO observed | Result | Notes |
|---|---|---|---|---|
| | | | | |

## Related
- Enablement is tracked as **R-1** in `docs/audit/current-platform/19_RISK_REGISTER.md`.
- Backup script: `ops/backup_db.sh`. Scheduled workflow: `.github/workflows/backup.yml`.
