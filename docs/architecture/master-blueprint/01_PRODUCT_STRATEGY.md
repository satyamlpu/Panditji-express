# 01 — Product Strategy

## Vision
Pandit Ji Express is a **religious-services marketplace** that lets customers book
verified pandits for authentic pujas at home, with transparent pricing and samagri
included — operated like an on-demand service (instant or scheduled), launching in
**Uttar Pradesh** and expanding across India (international later, subject to
regulatory review).

## Problem → solution
- Finding a trustworthy, available, qualified pandit for a specific vidhi is ad-hoc,
  opaque on price, and unreliable on time.
- Pandit Ji Express standardises: **verified** supply, **transparent** pricing,
  **samagri included**, **on-time** arrival, and **server-verified payments**.

## Three apps + website (one backend)
| Surface | Primary job | Current state |
|---|---|---|
| Public website | Discovery, SEO, lead capture, booking entry | **[IMPLEMENTED]** Next.js site live at panditjiexpress.com |
| Customer app (Android/iOS) | Book, pay, track, rate | **[PARTIAL]** Expo app exists, not deployed; API hardcoded to localhost |
| Partner app (Android/iOS) | Receive offers, execute, earn | **[PARTIAL]** Expo app exists, not deployed |
| Admin CRM/CMS (web) | Operate marketplace + manage content | **[IMPLEMENTED]** admin panel live (website + marketplace modules) |

All four share **one FastAPI modular monolith** + PostgreSQL/Supabase. This is the
correct starting topology and is **preserved** (non-negotiable rule #14).

## Target segments
- **Customers:** urban/semi-urban households in UP needing pujas (Griha Pravesh,
  Satyanarayan, Navagraha, Ganesh, Rudrabhishek, and more over time). Hindi-first.
- **Partners (pandits):** verified priests seeking steady, fairly-paid bookings with
  logistics handled.
- **Internal staff:** ops, verification, finance, support, content/marketing,
  super-admin (role model already exists — see 10/22).

## Business model
- **Commission** on each completed booking (platform commission ledger entry
  already modelled — `mp_ledger_entry` with `platform_commission`). **[IMPLEMENTED]**
- Samagri inclusion as a value lever (pricing already carries inclusions).
- Future: add-ons, coupons, subscriptions **[MISSING / PROPOSED]**.

## Booking modes
- **Instant** (dispatch to nearest eligible online pandit) **[IMPLEMENTED]** —
  dispatch engine with offers + TTL exists (`app/marketplace/dispatch.py`).
- **Scheduled** (future-dated) **[PARTIAL / NEEDS-VALIDATION]** — booking carries a
  requested time; a scheduled-dispatch worker that wakes at T-minus is **[MISSING]**.

## Success metrics (targets, not current)
| Metric | Definition | Why |
|---|---|---|
| Booking conversion | completed / started checkout | funnel health |
| Fill rate | bookings matched to a pandit / requested | supply adequacy |
| Time-to-match | offer→accept latency | instant-booking UX |
| On-time rate | arrivals within window | core promise |
| Cancellation rate (by side) | customer vs partner | quality/supply |
| CSAT / rating | post-puja rating | trust |
| Partner earnings & payout SLA | ₹ + days-to-payout | supply retention |
| Repeat rate / retention cohorts | N-month repeat | LTV |

Analytics to compute these is **[MISSING]** (no event pipeline yet — see 17/18).

## Non-negotiable product principles
1. **Verified supply only** — no unverified pandit takes a booking (gate exists:
   `get_current_pandit` rejects non-approved/suspended).
2. **Money is sacred** — every financial op idempotent + transactionally safe +
   audited (ledger + audit_log exist; see 13).
3. **Security-by-default** — deny-by-default authz, OTP hardening, signed webhooks
   (partially in place; see 11).
4. **Preserve what works** — extend, never blind-rewrite.

## Strategic target: 100M users
Treated as a **north-star, not a verified capability**. No claim of current capacity
is made. 17/18 give a *staged* path with capacity *models* and the load-test
evidence that would be required before asserting any scale number.

## Open strategic decisions [NEEDS-VALIDATION]
- SMS/OTP provider + DLT registration (India) — blocks real mobile auth at scale.
- Payment gateway choice (Razorpay/PhonePe/etc.) — current payments are a
  **mock/dev** flow (`/payments/mock`, signed mock webhook).
- Pricing model depth (dynamic pricing, surge, add-ons, coupons).
- Geographic rollout sequencing within UP.
