# 05 — Customer App Audit (Expo / React Native)

`customer-app/` — Expo SDK 58, expo-router. Screens: `index`, `login`, `(tabs)/{index,bookings,notifications,profile}`, `book/[slug]`, `booking/[id]`. **Not built/published.**

## What's implemented (code present, wired to real endpoints)
| Flow | Endpoint | State |
|---|---|---|
| OTP login (phone → code) | `POST /api/v1/mp/auth/otp/request` + `/otp/verify` | 🟡 code complete, ⛔ blocked (no SMS; relies on `dev_code`) |
| Service discovery | `GET /api/v1/mp/discovery/services` | ✅ |
| Create booking | `POST /api/v1/mp/customer/bookings` | ✅ |
| Booking list / detail | `GET /api/v1/mp/customer/bookings[/id]` | ✅ |
| Live tracking | `GET …/bookings/{id}/tracking` | 🟡 polling, no realtime |
| Pay (mock) | `…/pay` + `POST /api/v1/mp/payments/mock/pay` | ⚙️ mock provider |
| Review | `POST …/bookings/{id}/review` | ✅ |
| Cancel | `POST …/bookings/{id}/cancel` | ✅ |
| Notifications | `GET …/notifications` + read-all | ✅ (pull only; no push) |
| Profile | `GET …/customer/profile` | ✅ |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| C-1 | **CRITICAL** | `API_BASE` is hardcoded to `http://localhost:8099` (android `10.0.2.2`). App **cannot reach production**; no env-based config | `customer-app/src/lib/api.ts:5-6` |
| C-2 | **CRITICAL** | OTP login depends on `dev_code` returned by the request call; in prod `dev_code` is null and there is no SMS → **login impossible** | `login.tsx:24`, backend prod guard |
| C-3 | HIGH | Not built/published to any store or Expo channel; no OTA update channel configured | no build artifacts / EAS config |
| C-4 | MEDIUM | Tracking is poll-based; no websocket/push → stale ETA, battery cost | `booking/[id].tsx:36-39` |
| C-5 | MEDIUM | Payment is `payments/mock/pay` — no real gateway, no 3DS/UPI | `booking/[id].tsx:68` |
| C-6 | LOW | No offline/empty/error-state coverage audit done this pass | n/a |

## Not verified
App was **not run** (read-only). Runtime behavior, build success, and store-readiness are **NOT VERIFIED**.

## Classification
Customer app: **BACKEND-CONNECTED but NOT DEPLOYED**; blocked by localhost base URL (C-1) and OTP delivery (C-2). Feature coverage is otherwise broad and real.
