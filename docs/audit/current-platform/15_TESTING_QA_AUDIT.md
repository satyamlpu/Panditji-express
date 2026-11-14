# 15 — Testing & QA Audit

## Backend test suite (verified — `backend/tests/`)
13 modules: `test_auth`, `test_content`, `test_enquiries`, `test_marketplace`, `test_marketplace_concurrency`, `test_marketplace_finance`, `test_marketplace_geo_postgis`, `test_marketplace_support`, `test_marketplace_tracking`, `test_public`, `test_services_admin` (+ conftest, init).

| Dimension | State | Evidence |
|---|---|---|
| Unit/integration (API) | ✅ | auth, content, services, enquiries, public, marketplace |
| **Concurrency tests** | ✅ | `test_marketplace_concurrency.py` — double-accept race, PG-only |
| **Finance tests** | ✅ | `test_marketplace_finance.py` — incl. over-refund race |
| Geo/PostGIS tests | ✅ | `test_marketplace_geo_postgis.py`, PG-gated |
| Tracking / support | ✅ | dedicated modules |
| DB matrix | 🟡 | SQLite default; PG-only tests **skip** on SQLite (`IS_SQLITE`); full suite verified on PG this session (reported: 55 pass PG / 51+6 skip on SQLite) |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| T-1 | HIGH | **No frontend tests** — no component/integration/E2E (Playwright/Cypress) for website or admin | no test config in `frontend/` |
| T-2 | HIGH | **No mobile tests** — customer/pandit apps untested | no test files in apps |
| T-3 | MEDIUM | PG-specific invariants only run when DATABASE_URL is Postgres; a dev running SQLite gets a false-green on concurrency/geo | `conftest.py IS_SQLITE` |
| T-4 | MEDIUM | No load/performance tests (claims of scale unbacked — see 17) | none |
| T-5 | MEDIUM | No security/DAST or dependency-scan in CI | `ci.yml` |
| T-6 | LOW | No coverage threshold gating in CI | `ci.yml` |

## Strengths
A **genuinely meaningful** backend suite: it tests the hard concurrency/finance invariants on real PostgreSQL in CI (PostGIS service container), not just happy-path CRUD. This is well above typical MVP coverage for the risk-bearing paths.

## Not verified
Tests were **not re-run** this read-only pass; pass/skip counts are from the prior session's verified run, restated, not re-measured now.

## Classification
Testing: **STRONG on backend risk paths, ABSENT on frontend/mobile/load/security.** The coverage gap is breadth (UI, E2E, load), not the critical-path depth.
