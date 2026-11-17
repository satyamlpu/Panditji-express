# 02 — Customer App PRD (Android + iOS)

**Current state:** `customer-app/` is an **Expo SDK 58 / React Native 0.88 /
expo-router** app. Screens present: `(tabs)/index|bookings|notifications|profile`,
`book/[slug]`, `booking/[id]`, `login`. **[PARTIAL]** — `API_BASE` is hardcoded to
`localhost:8099`, so it is **not production-wired and not deployed**. It is a working
skeleton against the live backend contracts, not a shipped app.

## Target users & roles
- **Guest** (browse only) → **Registered customer** (phone-verified). One role; access
  is ownership-scoped (a customer sees only their own bookings/addresses).

## Primary journeys
1. Discover puja → configure (date/time/location/add-ons) → pay → matched to pandit →
   track → service → rate.
2. Scheduled booking: same, future-dated, with reminders.
3. Manage: reschedule / cancel / refund-status / history / invoices / support.

## Feature set (requested 1–34) with status

| # | Feature | Status | Evidence / gap |
|---|---|---|---|
| 1 | Onboarding | [PARTIAL] | `login.tsx`; no multi-step onboarding/consent |
| 2 | OTP auth | [IMPLEMENTED backend] / [PARTIAL app] | `/mp/auth/otp/request|verify`; prod needs SMS (dev returns `dev_code`) |
| 3 | Customer profile | [PARTIAL] | `profile.tsx`, `mp_customer`; edit flows thin |
| 4 | Language selection | [PARTIAL] | `mp_customer.language` exists; app picker [MISSING] |
| 5 | Location/address mgmt | [IMPLEMENTED] | `mp_customer_address` table + customer router |
| 6 | Service discovery | [IMPLEMENTED] | `/mp/discovery`, `/public` services |
| 7 | Categories | [IMPLEMENTED] | `category`, `service` |
| 8 | Puja details | [IMPLEMENTED] | service detail + inclusions |
| 9 | Samagri details | [PARTIAL] | inclusions text on service; no structured samagri entity |
| 10 | Pandit discovery | [PARTIAL] | dispatch picks pandit; customer-facing browse limited |
| 11 | Pandit profiles | [PARTIAL] | `mp_pandit` + rating; public profile screen [MISSING] |
| 12 | Availability | [PARTIAL] | pandit online/offline + heartbeat; calendar [MISSING] |
| 13 | Instant booking | [IMPLEMENTED] | `create_booking` + dispatch |
| 14 | Scheduled booking | [PARTIAL] | time captured; scheduled dispatch worker [MISSING] |
| 15 | Pricing breakdown | [IMPLEMENTED] | price_paise + ledger components |
| 16 | Add-ons | [MISSING] | — |
| 17 | Coupons | [MISSING] | — |
| 18 | Checkout | [PARTIAL] | pay endpoint; UI thin |
| 19 | Payment | [PARTIAL/DEV] | mock gateway + signed mock webhook; real PG [MISSING] |
| 20 | Booking confirmation | [IMPLEMENTED] | booking status + notification |
| 21 | Pandit assignment | [IMPLEMENTED] | dispatch assign + `assigned_pandit_id` |
| 22 | Realtime tracking | [PARTIAL] | tracking fields/events exist; realtime transport [MISSING] |
| 23 | Notifications | [PARTIAL] | `mp_notification` in-DB; push transport [MISSING] |
| 24 | Rescheduling | [MISSING] | — |
| 25 | Cancellation | [IMPLEMENTED] | `cancel_booking` (dispatch) |
| 26 | Refund status | [IMPLEMENTED backend] | `mp_refund` + finance |
| 27 | Booking history | [IMPLEMENTED] | `bookings.tsx` + customer list |
| 28 | Invoices/receipts | [MISSING] | no invoice generation |
| 29 | Ratings & reviews | [IMPLEMENTED] | `mp_review`, one-per-booking |
| 30 | Customer support | [PARTIAL] | tickets backend exists; app entry [MISSING] |
| 31 | Dispute management | [PARTIAL] | tickets; structured disputes [MISSING] |
| 32 | Privacy settings | [MISSING] | — |
| 33 | Account deletion | [MISSING] | required for store compliance (DPDP/Play) |
| 34 | Device/session mgmt | [PARTIAL] | refresh tokens exist (web); mobile session mgmt [MISSING] |

## Screens & navigation (target)
- **Tabs:** Home (discover), Bookings, Notifications, Profile. (present)
- **Stack:** Service detail → Configure → Address/Date → Review & pay → Confirmation
  → Live tracking → Rate. Add: Pandit profile, Reschedule, Support/ticket, Invoice,
  Privacy & account deletion. **[PROPOSED]**

## Cross-cutting requirements (per-screen acceptance criteria apply)
- **Error states:** network error, 401 (re-auth), 409 (conflict, e.g. slot taken),
  422 (validation), 429 (rate-limited), payment failure, no-pandit-available.
- **Loading states:** skeletons for lists/detail; optimistic nothing on money.
- **Empty states:** no bookings, no results, no notifications, no saved addresses.
- **Offline:** read-cached last lists; **block** booking/pay offline with clear
  messaging; queue nothing that mutates money. **[PROPOSED]**
- **Accessibility:** dynamic type, min 44pt targets, screen-reader labels, color
  contrast, RTL-safe (Hindi/Devanagari), haptics optional. **[PROPOSED]**
- **Analytics events:** view_service, start_booking, select_datetime, add_address,
  start_checkout, payment_success/fail, booking_confirmed, pandit_assigned,
  track_open, cancel, review_submit. Pipeline **[MISSING]**.

## Security requirements
- Secure token storage in Keychain/Keystore (`expo-secure-store`) — **[MISSING]**
  (app currently uses AsyncStorage per deps). TLS + cert handling, no secrets in
  bundle, biometric step-up for payment/cancel **[PROPOSED]**.

## Key edge cases
- No pandit available within radius/time → offer scheduled fallback or notify-on-match.
- Payment success but dispatch fails → money captured, booking unassigned → auto-refund
  or manual ops queue (finance + audit already support refunds).
- Duplicate pay taps → idempotency required (see 13).
- OTP abuse → rate limits exist (`mp_otp:{ip}:{phone}` 5/10min).
- Customer cancels after pandit en-route → cancellation fee policy **[NEEDS-VALIDATION]**.
