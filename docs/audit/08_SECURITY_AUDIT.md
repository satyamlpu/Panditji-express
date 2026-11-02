# 08 — Security Audit (defensive review)

OWASP-oriented, read-only. No exploitation, no external scans, no secret values printed. The tree is **not** a git repo, so "present" below means present in the delivered folder. All backend DB access is ORM/parameter-bound — the only raw SQL is a SQLite `PRAGMA` (`db/session.py:30`); **no SQL-injection surface found**. CORS uses an explicit origin list, not `*` (`main.py:50`, `config.py:84-85`).

## Strong baseline (verified positives)
- **Password hashing:** Argon2id + timing-equalising dummy verify for unknown emails (`core/security.py:21-53`, `services/auth_service.py:43`).
- **Token trust:** access JWT carries only `sub`; **role/status re-read from DB every request** (never trusted from the token) (`core/security.py:61-70`, `api/deps.py:44-67`).
- **Refresh tokens:** rotating + revocable, persisted by `jti`, revoked on use (`auth_service.py:69-110`); httpOnly cookie scoped to `/api/v1/auth` (`api/routers/auth.py:35-44`); BFF keeps JWTs out of the browser (`frontend/src/app/api/auth/login/route.ts`, `lib/session.ts`).
- **Object-level authz:** customer rows scoped by `customer_id` (`customer.py:230-244`), pandit by `assigned_pandit_id` (`pandit.py:276-283`), tickets by `opener_id` (`customer.py:509-524`).
- **RBAC:** `require_staff(role)` on admin routers (`principals.py:107-118`, used in `admin.py`, `admin_finance.py`).
- **Payments:** HMAC-SHA256 webhook, constant-time compare, DB-idempotent on unique ids, append-only ledger, dev `mock/pay` disabled in prod (`finance.py:47-54`, `payments.py:33,55`).
- **Headers/errors:** strict `CSP default-src 'none'`, HSTS in prod (`core/middleware.py:14-32`); `/docs`+`openapi.json` disabled in prod (`main.py:42-44`); errors don't leak internals in prod (`core/errors.py:101-109`).
- **OTP:** request rate-limited 5/10min per ip+phone; dev code only returned when not prod (`routers/auth.py:30-48`). **Uploads:** reject SVG, 3 MB cap, random filename (`api/routers/admin_media.py:31-65`).

## Findings

| ID | Severity | Component | Finding & evidence | Business impact | Remediation | Verify |
|---|---|---|---|---|---|---|
| S1 | **HIGH** | Payments config | **Prod can boot with default `payment_webhook_secret`/`revalidate_secret`** — `validate_runtime()` checks only `jwt_secret` (`config.py:93-99`; default secret `:64`). Forged signed webhooks → mark any booking PAID + post payable ledger. | Financial fraud / fake payouts | Reject default `payment_webhook_secret` & `revalidate_secret` in prod in `validate_runtime()`; move to a secret store. | Unit test: prod + default secret → startup raises. |
| S2 | **MEDIUM** | Frontend CMS render | **Weak regex HTML sanitizer** (`frontend/src/lib/markdown.ts:17-31`) strips only *quoted* `on*=`/`javascript:`; `<img src=x onerror=alert(1)>` survives → `dangerouslySetInnerHTML` (`MarkdownPage.tsx:28`, `contact-us/page.tsx:85`). Admin-authored (lower likelihood). | Stored XSS in admin/site | Replace with allowlist sanitizer (isomorphic-dompurify). | Render a payload with unquoted handler → confirm neutralised. |
| S3 | **MEDIUM** | Frontend SEO | **JSON-LD injection** — `JSON.stringify(ld)` via `dangerouslySetInnerHTML` without escaping `<`/`</script>` (`(site)/page.tsx:122`, `faqs/page.tsx:39`, `puja-services/[slug]/page.tsx:106,111`, `Breadcrumbs.tsx:47`). CMS content with `</script>` breaks out. | Stored XSS | Escape `<` → `<` before injection. | CMS field containing `</script><script>…` → confirm inert. |
| S4 | **MEDIUM** | Dispatch | **Accept race not guarded on Postgres** (`dispatch.py:261-334`; docstring-only FOR UPDATE). Concurrency untested. | Double-assignment / stuck partners | `with_for_update()` + unique assignment invariant. | Concurrency test: 2 concurrent accepts → one 409. |
| S5 | LOW | Auth (pandit) | **Suspended pandit keeps API access** — `get_current_pandit` returns a principal regardless of status (`principals.py:88-104`); customer path blocks suspended (`:83-84`). Online/dispatch gate on APPROVED, so limited, but profile/heartbeat/location/support reachable. | Suspended actor residual access | Add a status gate in `get_current_pandit`. | Suspend a pandit → protected calls 403. |
| S6 | LOW | Uploads | **Trusts client Content-Type; buffers whole file before size check** (`admin_media.py:47,55-56`). Served with forced ext + nosniff (low polyglot impact); unbounded read = minor DoS. | DoS / content spoof | Sniff magic bytes; stream-limit the read. | Upload a renamed non-image / oversized file → rejected early. |
| S7 | LOW | OTP storage | **OTP stored as unsalted SHA-256** (`otp.py:24`) — 900k space, brute-forceable if DB leaks; per-row attempt limit resets on re-request (not a practical live bypass; request path rate-limited). | OTP compromise on DB leak | Hash with a keyed HMAC/argon2 + short expiry; global per-phone attempt budget. | Review hash; attempt a code-guess loop → blocked. |
| S8 | LOW | Rate limiting | **`client_ip` ignores `X-Forwarded-For`** (`deps.py:77`, `principals.py:121`) → behind a proxy, login/OTP limits collapse to the proxy IP. Also the limiter is **in-memory** (single instance only, see `09`). | Rate-limit bypass/ineffective at scale | Parse a trusted XFF in prod; move limiter to Redis. | Behind proxy, vary client IP → limit applies per client. |
| S9 | LOW | Config | **`debug` defaults True, independent of `app_env`** (`config.py:27`); 500 handler leaks `str(exc)` when debug (`errors.py:105`); `validate_runtime` doesn't force it off in prod. | Info leak if misconfigured | Force `debug=False` when `is_production`. | Prod config → 500 returns generic body. |

## Secret management (no leaks found)
`backend/.env` and `frontend/.env.local` are present but contain **dev placeholders only** (e.g., `JWT_SECRET=change-me-in-production`), matching `.env.example`; `.env` is gitignored in both. No real/production secrets in the tree or source (source "secrets" are dev fallbacks in `config.py`). **The default seed-admin password `Admin!Pandit123` (`config.py:59`) must be changed for any deployment.**

## Dependency vulnerabilities — NOT VERIFIED
No `npm audit`/`pip-audit` run (read-only scope). Static view: backend pins look current (fastapi ≥0.118, sqlalchemy ≥2.0.43, pyjwt ≥2.10, argon2-cffi); frontend current (next ^15.5.28, react 19, zod ^3.24, marked ^14.1.4). Run both audits in CI as a follow-up.

## OWASP quick map
A01 Broken Access Control — good object-level + RBAC (watch S5). A02 Crypto — argon2id good; OTP hash weak (S7). A03 Injection — no SQLi; XSS via S2/S3. A05 Misconfig — S1/S9. A07 Auth — strong (OTP brute-force bounded). A08 Integrity — webhook HMAC good; S1 undermines it if misconfigured. A09 Logging — minimal ops logging (see `12`). A04 Insecure Design — the concurrency gaps (S4, R2/R3).
