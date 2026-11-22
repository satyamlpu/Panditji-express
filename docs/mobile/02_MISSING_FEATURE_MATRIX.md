# Mobile — Missing-Feature Matrix

Every requested feature classified. **"Implemented" = wired end-to-end in source, NOT
device-verified.** Nothing is **Verified** (no device/emulator run this pass).
Legend: Impl=Implemented · Part=Partially · UI=UI-only · BE=Backend-only ·
NC=Not-connected · NI=Not-implemented · Brk=Broken-for-prod.

## PART A — Customer App (1–28)
| # | Feature | Class | Notes |
|---|---|:--:|---|
| 1 | Splash & onboarding | Part | splash asset + login; no real onboarding flow |
| 2 | Language selection | NI | backend `language` field exists; no app picker (BE field) |
| 3 | Mobile OTP auth | Impl | otp request/verify wired |
| 4 | Secure sessions | Part | AsyncStorage (not SecureStore); no refresh token |
| 5 | Customer profile | Part | read wired; edit (PATCH) not wired |
| 6 | Home & service discovery | Impl | discovery/services wired |
| 7 | Categories & search | Part | services yes; category filter/search thin |
| 8 | Puja/service detail | Impl | `book/[slug]` |
| 9 | Pandit discovery & profiles | BE | `/discovery/pandits` exists, not wired |
| 10 | Location & saved addresses | BE | `/customer/addresses` exists, not wired |
| 11 | Instant booking | Impl | create booking wired |
| 12 | Scheduled booking | Part | backend partial; app date/time thin; no scheduled dispatch |
| 13 | Availability selection | Part | — |
| 14 | Price breakdown | Part | base price shown; add-ons absent |
| 15 | Coupons & add-ons | NI | no backend, no app |
| 16 | Checkout & payment | Brk | **mock** pay wired; real gateway missing → non-functional in prod |
| 17 | Booking confirmation | Impl | status + confirmation |
| 18 | Pandit assignment | Impl | backend dispatch; app shows assigned pandit |
| 19 | Tracking & ETA | Part | tracking poll wired; no realtime; ETA partial |
| 20 | Booking history | Impl | bookings list wired |
| 21 | Reschedule & cancellation | Part | cancel wired; **reschedule missing** |
| 22 | Refund status | Part | refund backend exists; app display thin |
| 23 | Ratings & reviews | Impl | review wired |
| 24 | Notifications | Part | in-app list wired; **push missing** |
| 25 | Customer support | BE | tickets backend exists, not wired |
| 26 | Profile & privacy | Part | profile read; privacy settings missing |
| 27 | Account deletion | NI | required by stores + DPDP |
| 28 | Device & session mgmt | Part | session yes; device registry/revoke missing |

## PART B — Partner App (1–31)
| # | Feature | Class | Notes |
|---|---|:--:|---|
| 1 | Registration | Impl | onboard wired |
| 2 | OTP auth | Impl | — |
| 3 | Profile creation | Impl | profile + onboard |
| 4 | KYC documents | NI | **no upload endpoint** (verification is admin-side) |
| 5 | Verification status | Part | status readable via profile |
| 6 | Approval/rejection | BE | admin decides; app reflects status |
| 7 | Service expertise | Part | `pandit_capability` backend; app selection thin |
| 8 | Languages | Part | field exists; selection thin |
| 9 | Service areas | Part | radius backend; polygon zones absent; app config thin |
| 10 | Availability calendar | NI | only online/offline today |
| 11 | Online/offline status | Impl | availability toggle + heartbeat wired |
| 12 | Booking offers | Impl | booking-requests wired |
| 13 | Accept/reject | Impl | wired (atomic on backend) |
| 14 | Offer expiry | Impl | backend 60s TTL; app reflects |
| 15 | Booking assignment | Impl | wired |
| 16 | Booking details | Impl | `job/[id]` |
| 17 | Navigation | NI | no maps deep-link |
| 18 | Location updates | Impl | location post wired |
| 19 | Arrival confirmation | Impl | status step |
| 20 | Puja checklist | NI | — |
| 21 | Service execution | Impl | status advance wired |
| 22 | Completion confirmation | Impl | `completed` status |
| 23 | Earnings | UI | earnings tab exists; **no earnings endpoint** (derive from ledger) |
| 24 | Commission | BE | ledger `platform_commission`; app display thin |
| 25 | Ledger | BE | `mp_ledger_entry` exists; app display thin |
| 26 | Payout requests | NI | payout is admin-initiated; no self-request endpoint |
| 27 | Bank verification | NI | no bank entity / penny-drop |
| 28 | Booking history | Impl | bookings list wired |
| 29 | Ratings | BE | rating aggregation backend; app display thin |
| 30 | Support | BE | tickets backend exists, not wired |
| 31 | Security & suspension | Part | suspension enforced backend (403); app 403 handling thin |

## Summary counts (approximate)
- **Customer:** ~8 Implemented, ~11 Partial, ~3 Backend-only, ~1 Broken(mock), ~5 Not-implemented.
- **Partner:** ~13 Implemented, ~6 Partial, ~5 Backend-only, ~1 UI-only, ~6 Not-implemented.
- **Verified: 0** (nothing run on a device in this audit).

## The decisive blockers (make "Implemented" flows non-functional in prod)
1. **OTP SMS** absent → login can't complete in prod.
2. **Payment** is mock → no real checkout.
3. **Secure token storage / refresh** → security + session UX.
4. **Push** → no real notifications.
These gate PART A/B regardless of app UI completeness.
