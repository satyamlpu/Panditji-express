# 06 — Pandit Partner App Audit (Expo / React Native)

`pandit-app/` — Expo SDK 58, expo-router. Screens: `index`, `login`, `onboard`, `(tabs)/{index,jobs,earnings,profile}`, `job/[id]`. **Not built/published.**

## What's implemented (wired to real `/partner` endpoints)
| Flow | Endpoint | State |
|---|---|---|
| OTP login | `/api/v1/mp/auth/otp/*` | 🟡 code complete, ⛔ blocked (no SMS) |
| Onboard (set base loc) | `POST /api/v1/mp/partner/onboard` | 🟡 base lat/lng **hardcoded to a Kanpur demo point** |
| Profile | `GET /api/v1/mp/partner/profile` | ✅ |
| Availability toggle | `PATCH …/partner/availability` | ✅ |
| Heartbeat (online) | `POST …/partner/heartbeat` | ✅ |
| Booking requests (offers) | `GET …/partner/booking-requests` | ✅ |
| Accept / reject offer | `POST …/booking-requests/{id}/{action}` | ✅ (backend accept is atomic — see 10) |
| Jobs / bookings list | `GET …/partner/bookings` | ✅ |
| Job detail + status transitions | `POST …/bookings/{id}/status` | ✅ |
| **Live location sharing** | `POST …/partner/location` (returns ETA) | 🟡 simulated movement, active-only |
| Earnings | derived from `…/partner/bookings` | ✅ (gross, pre-commission — labelled honestly) |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| P-1 | **CRITICAL** | `API_BASE` hardcoded `http://localhost:8099` — cannot reach prod | `pandit-app/src/lib/api.ts:5-6` |
| P-2 | **CRITICAL** | OTP login blocked in prod (no SMS; `dev_code` only) | `login.tsx`, 03 |
| P-3 | HIGH | Onboarding **hardcodes base location** to a Kanpur demo point; no real GPS/geocode capture | `onboard.tsx:62-63,127` |
| P-4 | HIGH | Location updates are a **simulated interpolation** toward dest, not device GPS | `job/[id].tsx:49-54` |
| P-5 | HIGH | Not built/published; no EAS/OTA channel | no build config |
| P-6 | MEDIUM | Offer polling in `(tabs)/index.tsx` (no push) → missed/stale offers, battery | `(tabs)/index.tsx:42` |
| P-7 | LOW | Earnings are gross, labelled "before platform fees" — correct but no settled-payout view in-app | `earnings.tsx:84,104` |

## Strengths
- Full partner lifecycle modeled: onboard → go online → receive offer → accept → navigate (location/ETA) → status transitions → earnings.
- Honest earnings labelling; accept flow backed by the hardened atomic accept.

## Not verified
App **not run**; runtime/build/store-readiness **NOT VERIFIED**. The real-GPS gap (P-3/P-4) is from code, not a live test.

## Classification
Pandit app: **BACKEND-CONNECTED, NOT DEPLOYED**, with two demo-stubs (hardcoded base location, simulated GPS) that must become real device GPS before production.
