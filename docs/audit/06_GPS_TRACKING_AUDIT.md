# 06 — Location & GPS Tracking Audit

Tracking is **HTTP-polling based**, not realtime. There is no WebSocket/SSE and no background-location pipeline. Server endpoints: pandit `POST /api/v1/mp/partner/location` (writes live position), customer `GET /api/v1/mp/customer/bookings/{id}/tracking` (reads ETA/freshness).

## Current implementation
- **Pandit → server** (`routers/pandit.py` `post_location`): accepts `{lat, lng, accuracy_m}`, **purpose-limited** — rejects with 409 unless the pandit has an active (ASSIGNED-state) booking; stores `live_lat/lng/accuracy/at` on `mp_pandit` and touches the heartbeat; returns `{booking_code, eta_minutes}`. Good: location write is gated to an active job.
- **Customer ← server** (`routers/customer.py` tracking): returns `{booking_status, pandit_name, has_location, lat, lng, updated_at, freshness_seconds, is_stale, eta_minutes, dest_lat, dest_lng}` only while the booking is ASSIGNED; `is_stale` flag when the position is old.
- **ETA** (`eta.py`) + **distance** (`geo.py` haversine). No routing/road-network integration — ETA is straight-line/heuristic.
- **Clients**: the customer app polls tracking (~4s); the pandit app posts location periodically while on a job. In the shipped Expo apps this is a demo cadence; **real device GPS + OS permissions are not wired** in the apps' current state (NOT VERIFIED that native background-location is configured in `app.json`/config plugins).

## Evaluation vs the target architecture
| Concern | Status | Notes |
|---|---|---|
| Android/iOS permissions | **NOT VERIFIED / likely missing** | No evidence of `expo-location` + background modes in app config. |
| Background location | **Missing** | No background task; app-foreground polling only. |
| GPS accuracy | Partial | `accuracy_m` accepted and stored; not validated/thresholded. |
| Location freshness | **Done** | `freshness_seconds` + `is_stale` computed server-side. |
| Update frequency | App-driven | No server-enforced cadence or throttle. |
| API authorization | **Done** | Pandit-authenticated; write requires active booking; customer read scoped to own booking. |
| Realtime transport | **Missing** | Polling only; no push to customer. |
| ETA / route integration | Partial / Missing | Straight-line ETA; no maps/routing provider. |
| Battery consumption | N/A | No background strategy to assess. |
| Location retention | **Risk** | Only the *latest* live point is stored on `mp_pandit` (overwritten) — no history table, which is good for privacy, but there is **no explicit purge** when tracking ends (stale coordinates linger on the row until overwritten or the pandit goes offline). |
| Tracking termination | Partial | Customer read stops returning location once the booking leaves ASSIGNED; the stored `live_lat/lng` on the pandit row is **not cleared** on completion. |
| Customer authorization | **Done** | Only the booking's customer can read its tracking. |
| Admin access controls | Partial | Admin booking detail can expose live location (need-to-know); fine, but ensure role-gated. |

## Privacy / correctness risks
1. **Stale location not purged on tracking end** — after completion/cancellation the pandit's last `live_lat/lng` remains on the row. Low exposure (reads are gated), but a cleanup on terminal transition is advisable (privacy-by-default). Severity: LOW–MEDIUM.
2. **No accuracy gating** — a low-accuracy or spoofed fix is stored and shown as ETA with no confidence floor. Severity: LOW.
3. **Polling cost** — customer polling every few seconds × many active bookings is wasteful and won't scale (see `09`); a realtime channel is the right long-term transport. Severity: scale concern.
4. **No data-retention policy** for any location data documented. Severity: compliance gap (see `18`).

## Recommendations
- Wire real device GPS + OS permissions (`expo-location`, foreground-service/background modes) in both apps, with explicit in-app consent copy.
- Clear `live_lat/lng/accuracy/at` on terminal booking transitions; document a retention policy.
- Add an accuracy floor and server-side update throttling.
- Replace polling with a realtime channel (WebSocket or managed) for active-booking tracking; keep polling as fallback.
- Integrate a maps/routing provider for road-distance ETA when budget allows (straight-line is acceptable for MVP).
- **This audit did not access any real location history** (none is stored beyond the latest point).
