# 05 — Booking & Dispatch Engine Audit

The critical business module. Code: `app/marketplace/dispatch.py`, `routers/customer.py`, `routers/pandit.py`, `constants.py`, `models.py`, `geo.py`, `eta.py`.

## 1. Existing booking lifecycle
States (`constants.py:75-106`): `requested → searching → awaiting_acceptance → confirmed → en_route → arrived → in_progress → completed`; terminals `expired`(dead), `no_partner_available`, `rejected`, `cancelled_customer/partner/platform`. Every transition appends to `mp_booking_event` (`dispatch.py:57-77`) — good auditability.

## 2. State-transition matrix

| From | To | Trigger / guard | Evidence |
|---|---|---|---|
| ∅ | requested | customer creates booking | `customer.py:203` |
| requested | searching | **immediate** dispatch starts | `dispatch.py:224-226`; only `IMMEDIATE` (`customer.py:224-225`) |
| searching / awaiting_acceptance | awaiting_acceptance | offer sent | `dispatch.py:158-165` |
| awaiting_acceptance | confirmed | pandit accepts **valid live** offer | `dispatch.py:296-309` |
| awaiting_acceptance | no_partner_available | attempts ≥ 5 or no eligible candidate | `dispatch.py:190-197`, `_no_partner` 203-219 |
| confirmed → en_route → arrived → in_progress → completed | **linear only** | pandit advances; strict guard | `_ADVANCE` map `dispatch.py:367-372`, `advance_status` 378-384 |
| any non-terminal | cancelled_* | customer/pandit/platform | `cancel_booking` `dispatch.py:424-431` (rejects if already terminal) |

**Formal state machine:** only `advance_status` (`dispatch.py:375-384`) is a real server-side guard — it enforces the strict linear post-confirmation machine and rejects skips/regressions (409). Everything **before** `confirmed` is enforced by scattered `if booking.status != …` checks inside `accept_offer`/`tick`/`reject_offer` — **not** a transition table. `BookingStatus.EXPIRED` is declared but **never written** (dead state; expiry advances the *attempt* outcome, not the booking).

## 3. Dispatch architecture
Sequential, single-offer, **in-process** (no worker). `dispatch.py`:
- **Eligibility** (`_rank_candidates:91-140`): capability match + `status==APPROVED` + `availability==ONLINE` + base lat/lng present + **fresh heartbeat** (`last_heartbeat >= now-HEARTBEAT_FRESH_SECONDS`) + within `service_radius_km` (haversine) + not already offered this booking. (Note: `HEARTBEAT_FRESH_SECONDS` value differs from the 120s mentioned elsewhere — confirm the live constant.)
- **Ranking** (`:136-139`): `(distance_km, -accept_rate, offers_received)` → nearest, then higher acceptance, then lighter load. Distance = haversine (`geo.py`), floats, no PostGIS.
- **Offer/TTL**: one partner at a time; `OFFER_TTL_SECONDS=60`, `MAX_DISPATCH_ATTEMPTS=5`.
- **Expiry: lazy only** — `tick()` runs on customer `GET /bookings/{id}` (`customer.py:273`); partner reads filter expired offers in-memory (`pandit.py:189-191`). **No scheduler/cron/background task** (none in `main.py`). An offer nobody polls never expires on its own.
- **Retry**: down the ranked list up to 5, then `no_partner_available`. No auto re-dispatch afterward.

## 4. Race-condition & correctness risk assessment

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **R1** | HIGH | **`accept_offer` is not atomic.** Guards are plain SELECTs; **no `with_for_update`, no version column, no unique constraint**. The docstring *claims* SQLite single-writer makes check-then-set atomic and that PG "would" need FOR UPDATE — but it's never applied. On PG READ COMMITTED two pandits can both pass the `status==awaiting_acceptance` check and both set `assigned_pandit_id` + mark themselves BUSY → last-writer-wins booking but **both partners stuck BUSY**. | `dispatch.py:261-334`, `:282`, `:296-301`; grep: no `with_for_update` |
| **R2** | HIGH | **Webhook/payment not idempotent under concurrency** → ledger double-post / double-credit. Single-threaded replays are safe (unique `provider_payment_id` + PAID short-circuit); concurrent duplicates both pass the dup-SELECT and both post ledger rows. | `finance.py:96-182`, cross-ref `07` |
| **R3** | HIGH | **Refund / payout over-issue** — read-modify-write on money with no lock: concurrent refunds both pass the "remaining" check; concurrent payouts both read the same unsettled set. | `finance.py:185-227`, `271-306` |
| **R4** | HIGH | **Scheduled bookings never dispatched** — only IMMEDIATE triggers dispatch; no scheduler exists, so `mode="scheduled"` sits at `requested` forever. | `customer.py:223-225` |
| **R5** | MED | **No idempotency key / dedupe on booking creation** — a retried POST creates a second booking + dispatch (rate-limited only). | `customer.py:141-227` |
| **R6** | MED | **Payment/booking state can diverge** — pay allowed broadly; `cancel_booking` frees the partner but never refunds → a cancelled, captured booking stays `paid` until manual admin refund. | `customer.py:410-427`, `dispatch.py:424-470` |
| **R7** | LOW/MED | **Lazy expiry** — TTL/acceptance-timeout only advance on a read; a booking can sit in `awaiting_acceptance` with no live offer. | `customer.py:273`, `dispatch.py:243-258` |
| **R8** | LOW | Availability-toggle vs `_make_offer` not serialized (minor, self-healing). | `pandit.py:122-144` |

## 5. Missing business rules
- Atomic/locked assignment; one-active-assignment DB invariant.
- A real **scheduler/worker** for: scheduled-booking dispatch, offer expiry, acceptance timeout, no-partner re-dispatch, auto-cancel of stale bookings.
- Idempotency keys (booking create, pay, accept).
- Payment↔booking state coupling (auto-refund on post-payment cancellation; block completion without payment where required).
- Concurrent-acceptance handling (first-accept-wins with explicit loser response).
- Conflicting-booking prevention for a pandit across overlapping scheduled slots (no slot/calendar model exists).

## 6. Recommended booking/dispatch architecture
1. **Atomic accept** (Postgres): `SELECT … FOR UPDATE` on the booking row inside the accept transaction, re-check status, set assignment; back it with a unique index making "one accepted attempt per booking" a DB invariant (so even a logic bug can't double-assign). Return a clean 409 to the losing pandit.
2. **Durable scheduler/queue** (e.g., a worker + Redis/DB-backed queue): offer-expiry timers, acceptance timeouts, scheduled-booking dispatch at `scheduled_at − lead_time`, no-partner re-dispatch, stale-booking auto-cancel. Removes all reliance on read-triggered `tick()`.
3. **Single formal state machine** wrapping *all* transitions (not just post-confirmation), with an allowed-transition table + actor/authorization checks, writing the event log centrally.
4. **Idempotency keys** on create/pay/accept (client-supplied key → unique constraint).
5. **Scheduling model**: a pandit availability/slot table to prevent double-booking across scheduled jobs.
6. **PostGIS** eligibility (`ST_DWithin` + GiST) to replace the O(n) haversine scan at city scale.
7. **Payment/booking invariants**: cancellation after capture enqueues a refund; a reconciliation job flags divergence.

> Do not claim atomic dispatch or conflict prevention until (1) and the unique invariant are implemented and covered by a concurrency test — currently neither exists.
