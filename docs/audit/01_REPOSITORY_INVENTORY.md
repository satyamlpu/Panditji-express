# 01 — Repository Inventory

Root: `/Users/satyamsharma/Assignment /Panditji Express/` (note the space). **Not a git repository** (`.git` absent at root; a nested `.git` exists under `customer-app` only). Four top-level projects + a README.

| Component | Technology | Location | Status | Findings |
|---|---|---|---|---|
| **Backend API** | FastAPI, SQLAlchemy 2 (async), pydantic v2, Alembic | `backend/app` | Implemented | Modular routers (CMS admin + marketplace customer/pandit/discovery/payments/admin). Security headers, centralized errors, `/health`. |
| DB (dev/test) | SQLite via aiosqlite | `backend/panditji.db`, `panditji_test.db` | Implemented (dev) | Single-writer; FK enforcement enabled via PRAGMA (`db/session.py:25-31`). **Prod Postgres wired but psycopg commented out** in `requirements.txt`. |
| Migrations | Alembic | `backend/alembic`, `alembic.ini` | Implemented | 5 linear versions (initial + marketplace phases 1–3). `render_as_batch`, `compare_type`. |
| Media storage | Local filesystem | `backend/uploads/` + `StaticFiles` mount (`main.py:88-90`) | Implemented (dev) | Images on local disk; **not** object storage. 3 MB cap, SVG rejected, random filename (`admin_media.py`). |
| Admin + Public web | Next.js 15 (App Router), React 19, React Query, Tailwind 3, Lucide, zod, react-hook-form | `frontend/` | Implemented | BFF proxy (`/api/backend`, `/api/auth/*`) with httpOnly refresh cookie. Admin redesigned (Cycle 1–2): Control Center + Website / App&CRM module shells. |
| Customer app | React Native + Expo SDK 58, expo-router, TS | `customer-app/` | Implemented | OTP login, discovery, booking (immediate), tracking (polling), pay, review. 401→login added. |
| Pandit Partner app | React Native + Expo SDK 58, expo-router, TS | `pandit-app/` | Implemented | OTP login, onboarding/verification gate, online toggle + heartbeat, offers accept/reject, status chain, location share, earnings. |
| Auth | JWT (HS256, access 15m / refresh 7d), argon2id, OTP | `backend/app/core/security.py`, `services/auth_service.py`, `marketplace/otp.py` | Implemented | Admin = JWT+rotating refresh; customer/pandit = OTP. Role re-read from DB (not trusted from token). |
| Payments | Mock gateway + HMAC webhook + integer-paise ledger | `backend/app/marketplace/finance.py`, `routers/payments.py` | Implemented (mock) | Production-shaped trust boundary; real gateway (Razorpay) is a drop-in per code comments. |
| Dispatch engine | In-process sequential single-offer | `backend/app/marketplace/dispatch.py` | Implemented (single-instance) | Capability+availability+heartbeat+radius eligibility, haversine ranking, 60s TTL, 5 attempts. **No background worker.** |
| Tracking / GPS | HTTP polling | pandit `POST /location`, customer `GET /tracking` | Implemented (polling) | No WebSocket/realtime. Purpose-limited to active booking. |
| Rate limiting | In-process token buckets | `backend/app/core/ratelimit.py` | Implemented (single-instance) | Login 10/min, OTP 5/10min, enquiry 8/hr. **Not multi-instance safe** (in-memory). |
| Audit log | DB table + `audit()` service | `backend/app/models/audit.py`, `services/audit.py`, `marketplace` `MpAudit` | Implemented | Admin/marketplace actions logged for forensics (not ops monitoring). |
| Background jobs / queue | — | — | **Missing** | No Celery/RQ/scheduler. Scheduled bookings + offer expiry have no runner. |
| Realtime | — | — | **Missing** | No WebSocket/SSE/managed realtime. |
| Cache | — | — | **Missing** | No Redis/memcached. |
| Containerization / CI / IaC | — | — | **Missing** | No Dockerfile, docker-compose, `.github/workflows`, Procfile, or IaC. |
| Monitoring / observability | stdlib logging only | `core/errors.py`, `services/revalidate.py` | **Minimal** | 500s + revalidation warnings only. No APM/Sentry/Prometheus. |
| Tests | pytest + pytest-asyncio (backend) | `backend/tests/` (10 files, ~46 tests) | Partial | Strong API/lifecycle/payment/tracking coverage. **No** concurrency, OTP-negative, refresh-rotation, or frontend/e2e tests. |
| Documentation | Markdown | `README.md` (214 lines) | Good | Tech stack, architecture, routes, data model, setup, env, security, testing, deployment outline. |
| Dependency hygiene | — | `backend/.venv/` (111 MB) shipped in tree | Note | gitignored but present in the delivered folder. |

### Dependency snapshot (static; CVEs NOT VERIFIED)
- **Backend** (`requirements.txt`): fastapi ≥0.118, uvicorn[standard] ≥0.34, sqlalchemy ≥2.0.43, aiosqlite ≥0.20, alembic ≥1.14, pydantic ≥2.11, pyjwt ≥2.10, argon2-cffi ≥23.1, python-multipart ≥0.0.20, httpx ≥0.28; `# psycopg[binary]>=3.2` (commented). Dev: pytest ≥8.3, pytest-asyncio, ruff.
- **Frontend** (`package.json`): next ^15.5.28, react 19, @tanstack/react-query ^5.62, react-hook-form ^7.54, zod ^3.24, tailwindcss ^3.4, lucide-react ^0.468, marked ^14.1.4, tailwind-merge ^2.6.
- **Mobile** (both apps): expo ~58, expo-router ~58, react-native 0.88, react 19.3, @react-native-async-storage/async-storage 2.2.

### Incomplete / abandoned / stub modules
- **Scheduled booking** path: created but never dispatched (`customer.py:223-225`).
- **`BookingStatus.EXPIRED`**: declared, never written (dead state).
- **Admin Media Library / SEO / Customers** pages: placeholders (added in UI Cycle 1; backend media endpoint exists, library UI is pending).
- **Notifications**: table + records exist; actual push/SMS delivery not implemented.
