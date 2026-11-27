# Load testing (k6)

Measurable scalability checks for Pandit Ji Express toward the 10M-registered-user
target. **Authored, not yet run** — run only in an **isolated/staging environment**
with explicit resource limits, never against production or shared infra.

## Why isolated-only
These scripts create real rows (OTP requests, bookings). Running them against
production would pollute data and trip rate limits for real users. Point them at a
disposable backend + database.

## Prerequisites
- [k6](https://k6.io/docs/get-started/installation/) installed.
- A staging backend URL and a PostgreSQL it owns.
- Loosen limits on the staging target so the limiter doesn't mask throughput:
  set `RATE_LIMIT_LOGIN_PER_MIN` high and configure a shared `REDIS_URL` if testing
  multiple API instances (otherwise each instance counts separately).

## Run
```bash
BASE_URL=https://staging.example.com k6 run backend/ops/loadtest/read_path.js
BASE_URL=https://staging.example.com k6 run backend/ops/loadtest/otp_request.js
BASE_URL=https://staging.example.com k6 run backend/ops/loadtest/booking_flow.js
```

## Scenarios
| Script | Path exercised | Notes |
|---|---|---|
| `read_path.js` | `/health`, `/api/v1/public/services`, `/api/v1/public/app-releases` | Unauthenticated read throughput (catalog/CDN-cacheable). |
| `otp_request.js` | `POST /api/v1/mp/auth/otp/request` | Unique phone per iteration to avoid the per-phone limit; per-IP limit still applies from one load box — run distributed or raise the limit on staging. |
| `booking_flow.js` | OTP → verify → `POST /mp/customer/bookings` (immediate) | Full write + dispatch path. Requires dev OTP (`sms_provider=none`) so the code is returned. |

## Targets (tune to infra; starting points, not guarantees)
These are **proposed** SLOs to validate, not measured results:
- Read path: p95 < 200 ms, error rate < 0.1% at the target RPS.
- OTP request: p95 < 400 ms.
- Booking create (incl. dispatch): p95 < 800 ms, zero double-assignment.

Capture latency (p50/p95/p99), throughput (RPS), error rate, and DB connection
saturation. Compare against pool size (`app/db/session.py`) and tune pool /
`REDIS_URL` / read-replica strategy from the results. Record findings in
`docs/production/FINAL-TEST-REPORT.md`.
