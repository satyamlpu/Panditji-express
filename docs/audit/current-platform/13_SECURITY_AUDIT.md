# 13 — Security Audit

## Posture summary
Solid fundamentals (argon2id, robust JWT lifecycle, security headers, secret guard, HMAC webhooks) with a **residual cluster** around rate limiting, OTP hashing, and RBAC enforcement.

## Verified controls
| Control | State | Evidence |
|---|---|---|
| Password hashing | ✅ | argon2id (argon2-cffi) |
| JWT | ✅ | HS256, access 15m / refresh 7d, rotation + revocation, role re-read on each request |
| Security headers | ✅ | `core/middleware.py`: `X-Content-Type-Options:nosniff`, `X-Frame-Options:DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Strict-Transport-Security: max-age=63072000; includeSubDomains` |
| CORS | ✅ | `allow_origins=settings.cors_origin_list` (explicit allowlist, per-origin) |
| Secret guard | ✅ | `config.validate_runtime()` rejects default JWT/webhook/revalidate secrets + forces `debug=False` in prod |
| Webhook auth | ✅ | HMAC-SHA256 (`finance.py:48`) |
| Suspended-user gate | ✅ | `principals.get_current_pandit` → ForbiddenError |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| **S-1** | **HIGH** | **Rate limiter is in-process** (`core/ratelimit.py`) — on Vercel each instance has its own counters → brute-force / OTP-flood / enquiry-spam limits are bypassable at scale. Needs Redis/Upstash or a DB-backed limiter | `core/ratelimit.py`; call sites in 08 B-1 |
| **S-2** | **HIGH** | **OTP stored as unsalted SHA-256** (`otp.py:25` `hashlib.sha256(code.encode())`) — a 4–6 digit space is trivially rainbow-tabled if the store leaks; also no per-OTP pepper | `marketplace/otp.py:11,25` |
| S-3 | HIGH | **RBAC not enforced per-endpoint** — `StaffRole`/`audit()` exist but admin mutations aren't uniformly role-gated server-side | marketplace admin routers; 07 A-1 |
| S-4 | MEDIUM | No centralized input sanitization for CMS rich text; relies on React escaping + CSP. Verify no `dangerouslySetInnerHTML` on CMS content | frontend CMS rendering (not re-verified this pass) |
| S-5 | MEDIUM | No secret rotation runbook / no secret manager (env vars only) | DEPLOYMENT.md |
| S-6 | MEDIUM | No monitoring/alerting on auth anomalies, no WAF | 14 |
| S-7 | LOW | CSP is API-appropriate (`default-src 'none'`) but the **frontend**'s own CSP/headers not audited this pass | frontend |

## Not verified
No dynamic security testing (DAST), dependency CVE scan, or pen-test performed this pass. Findings are from source review.

## Classification
Security: **GOOD fundamentals, NOT production-complete.** Priority fixes: distributed rate limiting (S-1), salt/pepper OTP (S-2), enforce RBAC (S-3). None are architectural — all are bounded changes.
