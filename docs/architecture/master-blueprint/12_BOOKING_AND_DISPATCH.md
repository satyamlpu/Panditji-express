# 12 — Booking & Dispatch

## Booking state machine (current) [IMPLEMENTED]
```
CREATED ─▶ DISPATCHING ─▶ CONFIRMED ─▶ EN_ROUTE ─▶ ARRIVED ─▶ IN_PROGRESS ─▶ COMPLETED
   │            │             │                                              
   └─ cancel ◀──┴─ no_partner ┴─ cancel/reassign (ops)                       
```
- Status + transitions recorded in `mp_booking.status` + `mp_booking_event`
  (append-only log). Status advance via `/mp/partner/bookings/{id}/status`
  (`dispatch.advance_status`); cancel via `dispatch.cancel_booking`.
- Every transition carries actor + reason + meta into `mp_booking_event`.

## Dispatch engine (current) [IMPLEMENTED]
- On booking create → `start_dispatch`: rank **eligible** pandits = APPROVED + ONLINE +
  fresh heartbeat + has capability for the service + within geo range (PostGIS or
  haversine fallback), ordered nearest-first (+ ETA via `eta.py`).
- Make **one offer** (`mp_dispatch_attempt` OFFERED) with **60s TTL**; on reject/expiry →
  `_offer_next_or_fail`; exhausted → `_no_partner` (audited).
- **Accept is atomic:** `accept_offer` locks the booking row (`SELECT … FOR UPDATE`),
  rejects if already assigned → prevents double-assignment (concurrency tests, PG-only).
- **Manual reassign** (ops): `manual_reassign` supersedes open offers, frees prior
  pandit, assigns new, audited (actor_id + IP after A-1 fix).

## Failure & recovery (current + target)
| Scenario | Current | Target |
|---|---|---|
| No eligible pandit | booking → no_partner, audited | notify-on-match queue / scheduled retry [PROPOSED] |
| Offer expiry | auto next offer | backoff + widen radius [PROPOSED] |
| Two pandits accept | atomic reject of loser (409) | keep |
| Assigned pandit goes offline | stays assigned | heartbeat-loss auto-reassign + ops alert [PROPOSED] |
| Customer cancels mid-flow | cancel path frees pandit | cancellation-fee policy [NEEDS-VALIDATION] |
| Instant with no supply | fails | fall back to scheduled [PROPOSED] |

## Scheduled booking [PARTIAL]
- Booking can carry a requested datetime, but there is **no worker** that wakes at
  T-minus to dispatch a scheduled booking. **[MISSING]** — needs a durable
  scheduler/queue (see 16/17). Design: enqueue `dispatch_at = start − lead_time`;
  worker runs dispatch; reminders to customer + pandit.

## Scale considerations (dispatch is the hottest path)
- Candidate query must stay indexed (geo + capability + heartbeat). **Target:** cache
  online-pandit presence in Redis (geo-set), do the fine filter in Postgres.
- Offer TTL expiry needs a timer source — currently implicit; **target:** durable
  delayed queue, not per-request polling.
- At high volume, `mp_dispatch_attempt` and `mp_booking_event` grow fast → partition by
  `created_at` when volume warrants (not pre-emptively).

## Acceptance criteria
- No double-assignment under concurrency (covered by PG concurrency tests).
- Every state change logged with actor/reason; illegal transitions rejected (409).
- Dispatch decisions reproducible from logged candidate set (target: log ranked set).
