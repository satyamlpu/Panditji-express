# 09 — Database Audit

PostgreSQL (Supabase, transaction pooler :6543) in prod; SQLite (aiosqlite) in dev/test. ~30 tables across `marketplace/models.py` + `app/models/*`. 8 Alembic migrations, linear history.

## Migration chain (verified)
`925cc5311b6c` initial → `6c9a619f2998` mp phase 1 → `66a529df0e5d` mp tracking → `bfeecbf3bd4b` finance+reviews → `47fbc8448ade` support tickets → **`a1c4e7d9b2f0` milestone-1 concurrency** → **`b2d5f8a3c1e4` integrity+indexes** → **`c3e6a9f1d4b7` postgis geo**.

## Integrity features (Milestone 1/2 — verified in code)
| Feature | Evidence |
|---|---|
| Partial unique: one accepted dispatch/booking | `uq_dispatch_one_accepted` (outcome='accepted') |
| Partial unique: one open payment/booking | `uq_payment_open_per_booking` (status IN created/paid) |
| CHECK constraints on enum columns | models.py |
| Composite indexes | `ix_pandit_dispatchable`, `ix_dispatch_booking_outcome`, `ix_payment_booking_status`, `ix_ledger_payable` |
| PostGIS geo column + GiST index | `base_geog geography`, `ix_pandit_base_geog`, trigger `trg_pandit_sync_geog` |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| D-1 | **HIGH** | **No backups / PITR policy documented** for a money-bearing DB (Supabase default tier may lack PITR) | no backup config in repo |
| D-2 | MEDIUM | SQLite dev / Postgres prod divergence — PostGIS + partial indexes + `with_for_update` only exercised on PG; SQLite tests skip these | conftest `IS_SQLITE` gating |
| D-3 | MEDIUM | PostGIS path is behind `geo_backend` flag; prod default is haversine — ST_DWithin index unused unless enabled | `config.py geo_backend`, `dispatch.py _use_postgis` |
| D-4 | LOW | No documented data-retention / PII-minimization policy (phone numbers, addresses stored) | models |
| D-5 | LOW | Seed data (`seed.py`) is for demo; ensure prod seed excludes demo accounts | `backend/seed.py` |
| D-6 | INFO | Supabase migrated + seeded this session (admin + 6 services/5 published) | session record |

## Strengths
Migration-backed schema with **DB-level invariants** (partial uniques + CHECKs) rather than app-only guards; composite indexes aligned to real query paths; PostGIS available when needed.

## Not verified
Actual Supabase backup/PITR settings, connection limits, and index usage stats were **NOT inspected** (no dashboard access this pass).

## Classification
Database: **IMPLEMENTED, well-constrained, migration-backed.** Primary gap is **operational (backups/DR, D-1)**, not schema design.
