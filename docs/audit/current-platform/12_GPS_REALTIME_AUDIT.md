# 12 — GPS & Real-time Audit

Tracking endpoints (`66a529df0e5d` migration + `pandit`/`customer` routers), pandit location push, customer tracking read.

## What exists (verified)
| Capability | State | Evidence |
|---|---|---|
| Pandit location update | 🟡 | `POST /api/v1/mp/partner/location` (returns ETA), active-only |
| Customer tracking read | 🟡 | `GET …/customer/bookings/{id}/tracking` |
| Heartbeat / online presence | ✅ | `POST …/partner/heartbeat`, availability toggle |
| ETA computation | ✅ | server returns `eta_minutes` on location update |
| Geo distance (matching) | ✅ | haversine / PostGIS ST_DWithin (see 10) |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| **G-1** | **HIGH** | **No realtime transport** — no WebSocket/SSE/push gateway. Customer tracking and pandit offers are **HTTP polling** → latency, stale ETA, server & battery cost | no ws/sse in backend; `booking/[id].tsx` polls |
| **G-2** | **HIGH** | Pandit location is a **simulated interpolation** toward destination, not device GPS; onboarding base location is **hardcoded to a Kanpur demo point** | `pandit-app job/[id].tsx:49-54`, `onboard.tsx:62-63` |
| G-3 | MEDIUM | No geofencing / arrival detection / route polyline | not present |
| G-4 | MEDIUM | No location history retention policy / privacy controls for live location | models, 13 |
| G-5 | LOW | ETA model is linear-fraction, not map/traffic-aware | `job/[id].tsx:49` |

## Strengths
The data model and endpoints for tracking exist and compute ETA server-side; the geo-matching layer is real and index-backed. The pieces are in place to swap simulation → real GPS + a realtime channel.

## Not verified
No live device test; realtime behavior **NOT VERIFIED** (none to verify — transport is absent).

## Classification
Real-time/GPS: **PARTIAL / DEMO-STUBBED.** Endpoints exist but location is simulated and transport is poll-only. Real device GPS + a realtime gateway (WebSocket/push) are required for a credible "live tracking" claim.
