# 10 — Booking & Dispatch Audit

Core marketplace loop: discovery → create booking → dispatch/offer → pandit accept → status transitions → tracking → payment → review.

## Dispatch engine (`app/marketplace/dispatch.py`)
| Capability | State | Evidence |
|---|---|---|
| Candidate ranking | ✅ | `_rank_candidates` |
| Geo matching | ✅ | branches `_use_postgis()` → `_within_range_postgis` (ST_DWithin) vs `_within_range_haversine` |
| Dispatchability filter | ✅ | `ix_pandit_dispatchable` (availability/status) |
| **Atomic accept** | ✅ | `accept_offer` `.with_for_update()` on booking + `try/except IntegrityError → ConflictError`; backed by `uq_dispatch_one_accepted` |
| Suspended-pandit gate | ✅ | `principals.get_current_pandit` raises `ForbiddenError` if SUSPENDED |
| Concurrency correctness | ✅ VERIFIED | `tests/test_marketplace_concurrency.py` (PG-only) — no double-accept |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| **DP-1** | **HIGH** | **Scheduled bookings are never auto-dispatched** — a future-dated booking is stored but no scheduler/worker fires dispatch at the scheduled time → silent business failure | no cron/worker in repo; dispatch is request-triggered |
| DP-2 | HIGH | No **offer timeout / re-offer** loop visible — if the first pandit never responds, no automatic fallback to the next candidate (needs a background tick) | `dispatch.py` (accept is reactive only) |
| DP-3 | MEDIUM | Offers reach the pandit app by **polling** (`booking-requests`), not push → latency, missed offers | `pandit-app (tabs)/index.tsx:42` |
| DP-4 | MEDIUM | PostGIS geo default off (haversine) — fine at small scale; enable + verify index before growth | 09 D-3 |
| DP-5 | LOW | No surge/priority/zone policy — flat ranking | `_rank_candidates` |

## Strengths
The **hardest correctness problem** — concurrent accept of the same booking — is solved at the DB level and **verified on PostgreSQL**. Geo matching has a scalable PostGIS path ready.

## Classification
On-demand dispatch: **IMPLEMENTED + concurrency-verified.** Scheduled dispatch and offer-timeout/re-offer: **NOT IMPLEMENTED** — the top functional gap for a real marketplace (needs a worker; see 20 roadmap).
