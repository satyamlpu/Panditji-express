# 08 — Backend API Audit

FastAPI modular monolith. Two surfaces: **content/admin API** (`app/api/routers/*`) and **marketplace API** (`app/marketplace/routers/*`). SQLAlchemy 2 async, Alembic (8 migrations), pydantic v2.

## Router inventory (verified)
**Content/admin:** `auth`, `public`, `admin_services`, `admin_categories`, `admin_locations`, `admin_testimonials`, `admin_faqs`, `admin_pages`, `admin_banners`, `admin_enquiries`, `admin_media`, `admin_settings`.
**Marketplace:** `auth` (OTP), `discovery`, `customer`, `pandit`, `payments`, `admin`, `admin_finance`, `admin_support`.

## Cross-cutting
| Concern | State | Evidence |
|---|---|---|
| Error envelope | ✅ | `core/errors.py` typed codes (incl. 429 `rate_limited`) |
| Config validation | ✅ | `config.py` `validate_runtime()` rejects default secrets + forces `debug=False` in prod |
| Health/readiness | ✅ | `/health`, `/health/db` (SELECT 1) |
| Serverless DB tuning | ✅ | `db/session.py` NullPool + `prepare_threshold=None` on Vercel |
| Rate limiting | 🔴 | `core/ratelimit.py` is **in-process fixed-window** — ineffective across serverless instances (each cold start = fresh counters) |
| AuthN | ✅ | JWT HS256, access 15m / refresh 7d, rotation + revocation, role re-read |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| B-1 | **HIGH** | In-process rate limiter does not hold on Vercel (per-instance memory) → login/OTP/enquiry/booking limits bypassable at scale | `core/ratelimit.py`, used in `auth.py:55`, `mp auth:30`, `customer:149`, `public:223` |
| B-2 | HIGH | OTP delivery absent — `mp/auth/otp/request` has no SMS provider; prod suppresses `dev_code` → marketplace auth unusable | `marketplace/routers/auth.py`, `otp.py` |
| B-3 | MEDIUM | Payments router is a **mock** (`payments/mock/pay`) — no real provider, no idempotency against a gateway | `marketplace/routers/payments.py` |
| B-4 | MEDIUM | RBAC not uniformly enforced on admin mutations (see 13 A-1) | marketplace admin routers |
| B-5 | LOW | No API versioning strategy beyond `/api/v1` prefix on marketplace; content API unversioned | router prefixes |
| B-6 | INFO | Live import of fastapi/sqlalchemy/psycopg confirmed via temporary `/diag` probe (removed) | this session |

## Strengths
Clean router separation, typed errors, runtime secret validation, serverless-aware DB session, atomic marketplace invariants (see 10/11), argon2id + robust JWT lifecycle.

## Classification
Backend: **IMPLEMENTED, hardened, live.** Top gaps are **distributed rate limiting (B-1)**, **OTP delivery (B-2)**, and **real payments (B-3)**.
