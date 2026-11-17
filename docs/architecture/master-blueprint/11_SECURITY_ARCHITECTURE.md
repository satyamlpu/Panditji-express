# 11 — Security Architecture

Security is a **platform capability**, not a feature. Verification references:
**OWASP ASVS, OWASP API Security Top 10, OWASP MASVS, NIST 800-63** identity guidance.
No certification is claimed; compliance requires a documented verification process
(see 19) that does not yet exist.

## Identity & sessions
| Control | Status | Notes |
|---|---|---|
| Secure auth (argon2, JWT HS256) | [IMPLEMENTED] | access 15m |
| OTP expiry + replay protection | [IMPLEMENTED] | TTL 5m, single-use, consumed flag |
| OTP keyed/salted hash | [IMPLEMENTED] | HMAC-SHA256(pepper, phone:code) |
| Attempt limits | [IMPLEMENTED] | 5 verify attempts + request rate-limit |
| Refresh rotation + revocation | [IMPLEMENTED] | `refresh_token` |
| Session revocation | [PARTIAL] | token revoke yes; device registry no |
| Device management | [MISSING] | — |
| Admin MFA | [MISSING] | add TOTP/WebAuthn |
| Step-up auth | [MISSING] | before refund/payout/suspend/role change |
| Account recovery | [MISSING] | — |

## RBAC + ABAC
Deny-by-default RBAC [IMPLEMENTED]; ABAC overlays (object/property/amount/geo/team,
separation-of-duties, break-glass) [MISSING/PROPOSED] — see 10.

## API security
| Control | Status |
|---|---|
| AuthN/AuthZ on every protected endpoint | [IMPLEMENTED] (no unguarded admin route found) |
| Input validation (Pydantic v2) | [IMPLEMENTED] |
| Output allowlist (response_model) | [IMPLEMENTED] |
| Rate limiting | [IMPLEMENTED] (login/OTP/booking/enquiry; fail-open on store outage) |
| Idempotency | [PARTIAL] (webhook/ledger; add keys to all money POSTs) |
| Secure CORS | [IMPLEMENTED] (explicit allowlist `CORS_ORIGINS`) |
| CSRF | [N/A/PARTIAL] (bearer tokens, not cookies for API; verify BFF cookie flows) |
| SSRF prevention | [NEEDS-VALIDATION] (revalidate POST to configured URL only) |
| SQL injection | [IMPLEMENTED] (ORM only; no raw/f-string SQL — verified) |
| XSS | [PARTIAL] (React escapes; CMS rich content needs sanitization review) |
| Secure headers | [IMPLEMENTED] (CSP default-src none on API, HSTS, X-Frame DENY, nosniff) |
| API versioning/inventory/deprecation | [PARTIAL] (v1 only; no deprecation policy) |

## Financial security
| Control | Status |
|---|---|
| Signed webhooks | [IMPLEMENTED] (HMAC signature on mock webhook) |
| Replay/duplicate-event handling | [IMPLEMENTED] (idempotent webhook) |
| Append-only ledger | [IMPLEMENTED] |
| Transactional updates | [IMPLEMENTED] (single request tx; row-locks on refund/accept/payout) |
| Reconciliation | [MISSING] |
| Maker-checker approvals | [MISSING] |
| Bank detail verification (penny-drop) | [MISSING] |
| Refund/payout controls | [PARTIAL] (role-gated + audited; no amount thresholds/second approver) |

## Data security
| Control | Status |
|---|---|
| Encryption in transit (TLS) | [IMPLEMENTED] (Vercel/Supabase TLS) |
| Encryption at rest | [IMPLEMENTED] (Supabase-managed) [NEEDS-VALIDATION of scope] |
| Secret management | [PARTIAL] (env vars + prod default-guard; no secret manager/rotation) |
| Key rotation | [MISSING] |
| Private document storage + short-lived signed URLs | [MISSING] (KYC docs) |
| Data minimization | [PARTIAL] (Sentry PII off; review field collection) |
| Retention policies | [MISSING] (see 21) |
| Secure deletion | [MISSING] (account deletion absent) |
| Audit trails | [IMPLEMENTED] (append-only audit_log) |

## Mobile security [mostly MISSING — apps are PARTIAL]
| Control | Status |
|---|---|
| Secure token storage (Keychain/Keystore) | [MISSING] (uses AsyncStorage) → use `expo-secure-store` |
| TLS + cert validation | [PARTIAL] (platform default) |
| Root/jailbreak + integrity signals | [MISSING] |
| Secure deep links | [NEEDS-VALIDATION] |
| Permission minimization | [PROPOSED] |
| Background location controls | [PROPOSED] (only on active job) |
| Sensitive-data screen protection | [MISSING] |
| Reverse-engineering resilience | [MISSING] (no secrets in bundle; API_BASE config) |

## Security program (process) [MISSING → PROPOSED]
- Threat model per module; dependency scanning (CI); SAST/secret-scan; periodic
  pen-test; vulnerability SLA; access reviews; incident response runbook (see 16/20);
  ASVS/MASVS/API-Top-10 checklists as **release gates** for security-critical work.

## Top security priorities (ranked)
1. Real OTP/SMS provider + keep OTP hardening (blocks safe mobile auth).
2. Real payment gateway with verified webhooks + idempotency keys (replace mock).
3. Admin MFA + step-up + maker-checker on money.
4. Object storage + signed URLs for KYC; secret manager + rotation.
5. RBAC/IDOR/concurrency/payment **security test suite** as a release gate.
