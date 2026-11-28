# Rollback Plan

How to revert each layer safely. Favor the least destructive action; never run
destructive DB operations without confirmation.

## Triggers
Roll back when, after a deploy: `/health/db` fails, error rate spikes in Sentry,
payments/bookings fail at elevated rates, or a data-integrity issue is found.
Decide fast; a clean revert beats debugging in production.

## Backend / web (Vercel)
- **Fastest:** in the Vercel dashboard, promote the previous successful
  deployment (instant, no rebuild). Do this first if the bad change is code/config.
- Config-only regression: restore the previous env values and redeploy.

## Database (Supabase)
Order of preference (least destructive first):
1. **Prefer forward fixes.** Most migrations here are additive (nullable columns,
   widened CHECKs) and do **not** require a DB rollback — reverting the code is
   enough.
2. **Alembic downgrade** one step if a migration must be undone and it is safe:
   `DATABASE_URL="<prod session-pooler/direct>" alembic downgrade -1`. Review the
   migration's `downgrade()` first — dropping a column loses its data.
3. **Point-in-time recovery / logical backup** for data corruption: Supabase PITR
   (see `backend/ops/RESTORE_RUNBOOK.md`) or restore the latest `backup_db.sh`
   archive into a new database, verify, then cut over. Never restore in place over
   a live DB without a backup of current state.

## Mobile
- OTA-eligible JS change: `eas update` to roll back the channel.
- Native build regression: halt the staged store rollout; promote the prior build.
  Mark the bad release **inactive** in CRM App Releases so `/download` stops
  offering it (store listings can't be instantly recalled).

## Integrations
- Payments: set `payment_provider=mock` (or disable live keys) to stop live
  charges while investigating; the ledger stays intact.
- SMS: set `sms_provider=none`/`console` to stop sends; OTP still issues.

## After any rollback
Record what happened, confirm `/health/db` + a smoke flow, and open a follow-up
to fix forward. Update `FINAL-TEST-REPORT.md` if the incident changes readiness.
