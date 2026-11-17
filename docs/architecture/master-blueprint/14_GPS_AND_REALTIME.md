# 14 — GPS & Realtime

## Current state [PARTIAL]
- **Data model exists:** pandit live-location fields + booking tracking fields +
  `mp_booking_event`; partner posts location via `POST /mp/partner/location`; customer
  reads via `GET /mp/customer/bookings/{id}/tracking` (migration `66a529..tracking`).
- **PostGIS** enabled for geo queries (dispatch range).
- **Gap:** there is **no realtime transport** — tracking is **HTTP request/response
  (poll)**, not a live stream. Continuous GPS streaming, live map, and push-based
  updates are **[MISSING]**.

## Target realtime architecture [PROPOSED]
```
Partner app ──(throttled GPS, active job only)──▶ POST /tracking (or WS)
                                                      │
                                           ingest + last-known in Redis
                                                      │  fan-out
Customer app ◀── live channel (Supabase Realtime / WS / SSE) ◀── location updates
```
- **Transport options (choose per evidence):**
  1. **Supabase Realtime** (already on Supabase) — lowest new-infra cost.
  2. **WebSocket/SSE** service — more control, more ops.
- **Ingestion:** partner posts location at a **throttled** cadence (e.g. 5–15s) **only
  while on an active job**; store last-known in Redis (fast) + periodic durable write to
  a **partitioned** `tracking_point` table (not every ping to Postgres).
- **Battery/permissions:** background-location only during active job; foreground
  service (Android) / background mode (iOS) with clear consent.

## Scale notes (GPS is a high-write path)
- At scale, GPS updates dominate write volume. **Do not** write every ping to Postgres;
  use Redis for live + batched/partitioned durable writes + retention (e.g. keep raw
  points 7–30 days, then aggregate/drop). Capacity model in 17.
- Geofencing (arrival detection) can run on last-known vs destination.

## Failure & recovery
| Scenario | Behavior / target |
|---|---|
| Partner loses signal | last-known shown with timestamp + "stale" indicator |
| Customer offline | reconnect → fetch last-known then resume stream |
| Realtime channel down | fall back to poll `GET …/tracking` |
| GPS spoofing | sanity checks (speed/teleport), not authoritative for payment |

## Acceptance criteria
- Tracking visible only to the booking's customer + assigned pandit + ops (authz).
- No continuous background tracking outside an active job.
- Realtime path degrades gracefully to polling.
- Location writes throttled; durable store partitioned + retention-bounded.
