# 20 — Backup & Disaster Recovery

Builds on [`backend/ops/RESTORE_RUNBOOK.md`](../../../backend/ops/RESTORE_RUNBOOK.md)
and the P0 backup/DR review. **Money system → loss/corruption must be recoverable.**

## Current state (honest ladder)
| | State | Verdict |
|---|---|---|
| A | Backup **script** exists (`backend/ops/backup_db.sh`, `pg_dump -Fc` + integrity check + retention) | ✅ |
| B | **Scheduled workflow** exists (`.github/workflows/backup.yml`, daily 02:17 UTC) | ✅ |
| C | A backup has **actually run** | ❌ needs `DATABASE_URL` repo secret |
| D | Backup **integrity verified** on a real archive | ❌ |
| E | **Restore drilled** into a scratch DB | ❌ (runbook + empty drill log) |
| F | Supabase **PITR enabled** | ❌ / unknown (dashboard action) |

**Backup readiness = A + B only. NOT yet recoverable-proven.**

## Two-layer strategy
1. **Layer 1 — Supabase PITR (primary):** point-in-time recovery, RPO ≤ 5 min target.
   Dashboard action (Pro plan). **Must enable + record retention window.**
2. **Layer 2 — Logical dumps (off-provider):** `pg_dump -Fc` daily, retained 14, pushed
   to **encrypted object storage** (target; currently GitHub artifacts, which the
   workflow itself flags as not a true vault). Use for migrations + restore drills +
   off-provider copy.

## Targets
- **RPO ≤ 5 min** (PITR), **RTO ≤ 1 h** — *proposed, confirm with business*; not yet
  demonstrated.

## Restore drill (quarterly + before risky migrations) [PROCESS — run it]
1. Restore latest dump into a **scratch** DB (never over prod).
2. Verify money-table row counts + newest rows + constraints (partial-unique/CHECK).
3. App smoke test against restored DB (`/health/db`, read a booking/payment).
4. Record real **RTO** in the drill log; tear down scratch DB.

## Gaps → actions
| Gap | Action |
|---|---|
| No backup has run | set repo secret `DATABASE_URL` (session-pooler URL), run workflow |
| Artifacts ≠ vault | push dumps to S3/GCS with SSE + lifecycle + least-privilege |
| No failure alert | add on-failure notification + "last-successful-backup age" check |
| PITR unknown | enable in Supabase, record window |
| No drill | run the first restore drill, fill the log |
| Client/server version | pin `pg_dump` to Supabase major version |

## DR scenarios
| Scenario | Recovery |
|---|---|
| Accidental bad write/delete | PITR to just before; or restore dump to scratch, extract |
| Region/provider outage | restore dump off-provider; update `DATABASE_URL`, redeploy |
| Corruption | PITR; verify constraints; reconcile ledger |
| Ransomware/credential leak | rotate secrets, restore clean, audit `audit_log` |

## Acceptance criteria
- Do **not** claim "backed up" until C–F are done and evidenced.
- Every destructive migration preceded by a verified backup.
- Backups encrypted in transit + at rest; access least-privilege; restores tested.
