# Mobile — API Dependency Matrix

Maps each app capability → backend endpoint → **Backend** (does the API exist?) →
**Wired** (does the app call it, verified from source?). Backend endpoints verified
from the FastAPI routers; wiring verified by grepping each app's `src/`.

## Customer app → `/api/v1/mp/*`
| Capability | Endpoint | Backend | Wired in app |
|---|---|:--:|:--:|
| Request OTP | `POST /mp/auth/otp/request` | ✅ | ✅ |
| Verify OTP → token | `POST /mp/auth/otp/verify` | ✅ | ✅ |
| Profile (read) | `GET /mp/customer/profile` | ✅ | ✅ |
| Profile (edit) | `PATCH /mp/customer/profile` | ✅ | ❌ not wired |
| Saved addresses | `GET/POST /mp/customer/addresses` | ✅ | ❌ not wired |
| Service discovery | `GET /mp/discovery/services` | ✅ | ✅ |
| Pandit discovery | `GET /mp/discovery/pandits` | ✅ | ❌ not wired |
| Serviceability | `GET /mp/discovery/serviceability` | ✅ | ❌ not wired |
| Create booking | `POST /mp/customer/bookings` | ✅ | ✅ |
| Booking list | `GET /mp/customer/bookings` | ✅ | ✅ |
| Booking detail | `GET /mp/customer/bookings/:id` | ✅ | ✅ |
| Booking events (timeline) | `GET /mp/customer/bookings/:id/events` | ✅ | ❌ not wired |
| Tracking | `GET /mp/customer/bookings/:id/tracking` | ✅ (poll) | ✅ |
| Pay | `POST /mp/customer/bookings/:id/pay` + `POST /mp/payments/mock/pay` | ⚠️ mock | ✅ (mock) |
| Cancel | `POST /mp/customer/bookings/:id/cancel` | ✅ | ✅ |
| Review | `POST /mp/customer/bookings/:id/review` | ✅ | ✅ |
| Notifications | `GET /mp/customer/notifications` + `read-all` | ✅ (in-DB) | ✅ |
| Support tickets | `POST/GET /mp/customer/support/tickets*` | ✅ | ❌ not wired |
| Reschedule | — | ❌ missing | ❌ |
| Add-ons / coupons | — | ❌ missing | ❌ |
| Invoices | — | ❌ missing | ❌ |
| Account deletion | — | ❌ missing | ❌ |
| Push register | — | ❌ missing | ❌ |

## Partner app → `/api/v1/mp/*`
| Capability | Endpoint | Backend | Wired in app |
|---|---|:--:|:--:|
| Request/verify OTP | `POST /mp/auth/otp/request|verify` | ✅ | ✅ |
| Onboard | `POST /mp/partner/onboard` | ✅ | ✅ |
| Profile (read) | `GET /mp/partner/profile` | ✅ | ✅ |
| Availability toggle | `PATCH /mp/partner/availability` | ✅ | ✅ |
| Heartbeat | `POST /mp/partner/heartbeat` | ✅ | ✅ |
| Location update | `POST /mp/partner/location` | ✅ | ✅ |
| Offers (list) | `GET /mp/partner/booking-requests` | ✅ | ✅ |
| Accept/reject offer | `POST /mp/partner/booking-requests/:id/accept|reject` | ✅ | ✅ |
| Assigned bookings | `GET /mp/partner/bookings` | ✅ | ✅ |
| Status advance | `POST /mp/partner/bookings/:id/status` | ✅ | ✅ |
| Services (ref) | `GET /mp/discovery/services` | ✅ | ✅ |
| Earnings | — (derived from ledger) | ❌ no endpoint | ⚠️ tab UI-only |
| Notifications | `GET /mp/partner/notifications` + read-all | ✅ | ❌ not wired |
| Support tickets | `/mp/partner/support/tickets*` | ✅ | ❌ not wired |
| KYC doc upload | — | ❌ missing (admin-side only) | ❌ |
| Bank verification | — | ❌ missing | ❌ |
| Payout request (self) | — (admin-initiated only) | ❌ missing | ❌ |
| Availability calendar | — | ❌ missing | ❌ |
| Push register | — | ❌ missing | ❌ |

## Reading of the matrix
- **Both apps' core loop is wired:** OTP → token → the primary journey (customer:
  discover→book→pay(mock)→track→cancel/review; partner: onboard→online→offer→accept→
  status→complete). This is real integration, not UI-only — but **not device-verified**.
- **Backend-only (exists, app ignores):** customer addresses, profile edit, booking
  events, support, pandit discovery; partner notifications, support.
- **Missing on both sides:** reschedule, add-ons/coupons, invoices, account deletion,
  push, KYC upload, bank verification, self-payout, availability calendar.
- **Mock/blocked for prod:** payment (mock gateway), OTP delivery (no SMS) — these make
  the wired flows non-functional in production until the backend integrations land.
