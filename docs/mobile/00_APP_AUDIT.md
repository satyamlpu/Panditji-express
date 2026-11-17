# Mobile Apps — PHASE 0 Audit (customer-app + pandit-app)

**Read-only inspection. No code changed, nothing built/deployed.** Date 2026-11-17.
Classification taxonomy used throughout: **Implemented / Partially / UI-only /
Backend-only / Not-connected / Not-implemented / Broken / Verified**. Nothing is
**Verified** — neither app has been run on a device/emulator in this pass.

## Both apps — shared facts (verified)
| Aspect | Finding |
|---|---|
| Framework | Expo SDK **~58.0.21**, expo-router **~58.0.28**, React Native **0.88.1**, React 19 |
| Entry | `expo-router/entry`; routes in `src/app/` |
| Language/TS | TypeScript (tsconfig present) |
| API client | `src/lib/api.ts` — **identical** in both apps (fetch wrapper, `ApiError`, bearer token, 401→logout handler) |
| API base | **hardcoded** `http://localhost:8099` (Android `10.0.2.2:8099`) — `src/lib/api.ts:5` |
| Auth token | persisted in **AsyncStorage** (`src/lib/auth.tsx`) — **not** SecureStore/Keychain |
| Refresh token | **none** — access-only (15 min); expiry ⇒ re-login (comment in `api.ts`) |
| Env config | **none** — no `.env`, no `app.config.*` |
| Components | one shared `src/components/ui.tsx` per app |
| Assets | icons + splash + favicon present (`assets/`) |
| Tests | **none** (no `*.test.*`) |
| EAS | **no `eas.json`** (not build-configured) |
| app.json | `ios`/`android`/`plugins` keys exist but **no `bundleIdentifier`, no `package`, no permissions** declared |
| Git | both apps in the initial commit `6a4f7f5` on `main`; not on a feature branch |

## Customer app (`customer-app/` — "Pandit Ji Express")
- **app.json:** name "Pandit Ji Express", slug `customer-app`, scheme `panditji`, version 1.0.0.
- **Screens (expo-router):** `index`, `login`, `(tabs)/{index,bookings,notifications,profile}`,
  `book/[slug]`, `booking/[id]`.
- **Auth:** `src/lib/auth.tsx` — AuthProvider, AsyncStorage persistence, OTP login,
  401→logout. In-memory token in `api.ts` set from storage on boot.
- **Wired endpoints (verified from source):** otp request/verify; discovery/services;
  customer profile (GET); bookings (create + GET list + GET `:id` + cancel + pay +
  review + tracking); notifications (GET + read-all); payments/mock/pay.
- **Not wired (backend exists, app doesn't call):** customer addresses
  (`/customer/addresses`), profile **edit** (PATCH), booking **events**
  (`/bookings/:id/events`), support tickets (`/customer/support/*`), pandit discovery
  (`/discovery/pandits`), serviceability (`/discovery/serviceability`).

## Partner app (`pandit-app/` — "Pandit Ji Partner")
- **app.json:** name "Pandit Ji Partner", slug `pandit-app`, scheme `panditjipartner`,
  version 1.0.0.
- **Screens:** `index`, `login`, `onboard`, `(tabs)/{index,jobs,earnings,profile}`,
  `job/[id]`.
- **Auth:** `src/lib/auth.tsx` (same pattern as customer).
- **Wired endpoints (verified):** otp request/verify; discovery/services; partner
  profile (GET), onboard, availability (PATCH), heartbeat, location, booking-requests
  (GET + accept/reject), bookings (GET), bookings/`:id`/status (status advance).
- **Not wired (gap):** partner notifications (`/partner/notifications`), partner
  support tickets (`/partner/support/*`). **Earnings** tab exists but there is **no
  earnings endpoint** in the backend (earnings derive from the ledger; the tab is
  UI-only / computed). **KYC document upload** and **bank verification** have **no
  backend endpoint** at all (verification is admin-side only).

## Backend contract (what the apps talk to) — context
FastAPI `/api/v1/mp/*` (auth, customer, partner, discovery, payments). OTP returns
`dev_code` only in non-prod; **no SMS provider** in prod. Payments are a **mock**
gateway. These two are the hard blockers for real app usage (see roadmap).

## Top cross-cutting gaps (both apps)
1. **API base hardcoded to localhost** → cannot talk to prod; needs env-based config (dev/preview/prod).
2. **Token in AsyncStorage, not SecureStore** → insecure at rest (PART D requirement).
3. **No refresh token** → sessions die at 15 min; poor UX; needs refresh or re-auth UX.
4. **No EAS config / bundle ids / permissions** → not buildable for stores.
5. **No push/location/secure-store libs** installed → core mobile features absent.
6. **No tests, no CI for mobile.**
7. **Prod login impossible without SMS**; **real payment missing** (mock only).

## Expo-version discipline (from each app's AGENTS.md)
Expo changes every SDK release — any package added later must use `npx expo install`
(SDK-resolved), verified against the SDK 58 docs. Libraries with native code need a
**development build** (not Expo Go). This governs PHASE 2+ (do not assume API shapes
from memory).
