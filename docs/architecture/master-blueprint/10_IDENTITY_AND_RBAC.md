# 10 — Identity & RBAC/ABAC

## Principals (current) [IMPLEMENTED]
| Principal | Auth | Token | Store |
|---|---|---|---|
| Admin/staff | email + password (argon2) | JWT access 15m + refresh 7d (rotation+revoke) | `admin_user`, `refresh_token` |
| Customer | phone + OTP | principal JWT (`kind=customer`) | `mp_customer` |
| Pandit | phone + OTP | principal JWT (`kind=pandit`) | `mp_pandit` |

- Role/status **always re-resolved from DB** per request (`get_current_admin`,
  `get_current_pandit`) — never trusted from the JWT. Suspension is immediate.
- OTP: HMAC-SHA256 keyed+phone-bound, constant-time compare, single-use, TTL 5m, 5
  attempts; request rate-limited. Replay-protected.

## Roles (current) [IMPLEMENTED]
- **Content side:** `Role.ADMIN` ("admin") = super-admin; `require_admin` gates all CMS.
- **Marketplace staff:** `StaffRole` = OPS, VERIFICATION, FINANCE, SUPPORT, MARKETING,
  SUPER_ADMIN("admin"); `require_staff(*roles)` allows the named role(s) + super-admin.
- **Deny-by-default** everywhere; wrong role → 403, unauth → 401.

## Gaps vs target
| Capability | Status |
|---|---|
| Role/permission **registry** (named permissions, not just roles) | [MISSING] |
| **Object-level** authz (ownership beyond principal type) | [PARTIAL] (customer scoping yes; generalized no) |
| **Property-level** authz (field redaction by role) | [MISSING] |
| **Team** permissions | [MISSING] |
| **Geographic** restriction (staff limited to a region) | [MISSING] |
| **Amount-based** approval (maker-checker over a ₹ threshold) | [MISSING] |
| **Separation of duties** (who approves vs who executes) | [MISSING] |
| **Time-limited emergency access** (break-glass, audited) | [MISSING] |
| **Admin MFA / step-up** | [MISSING] |
| **Device/session management** (list, revoke) | [PARTIAL] (refresh tokens; no device registry) |
| **Account recovery** | [MISSING] |
| Content **delegation** roles (MARKETING/CONTENT manage CMS) | [MISSING] |

## Target model (additive) [PROPOSED]
**RBAC core + ABAC overlays.**
1. **Permission registry:** `permission` (e.g. `finance.refund`, `partner.approve`,
   `cms.publish`) and `role_permission` mapping. Roles become bundles of permissions.
2. **Object-level checks** in a central policy function: ownership (`actor owns resource
   or has role`), resource-state gates.
3. **ABAC attributes:** region, team, amount, time. E.g. `finance.refund` allowed if
   `role=FINANCE AND amount ≤ threshold`; above threshold requires a **second approver**
   (maker-checker) recorded in `audit_log` + an `approval` row.
4. **Separation of duties:** the actor who creates a payout cannot approve it.
5. **Break-glass:** time-boxed elevated grant, fully audited, auto-expires.
6. **Admin MFA:** TOTP/WebAuthn for staff; **step-up** re-auth before high-risk actions
   (refund/payout/suspend/role-change).
7. **Device sessions:** `device_session` (device id, last-seen, revoke); session
   revocation already possible via refresh-token revoke — extend to a UI.

## Permission matrix
The authoritative role × resource × action grid is
[22_ADMIN_PERMISSION_MATRIX](22_ADMIN_PERMISSION_MATRIX.md).

## Acceptance criteria (authz)
- Every protected endpoint has an explicit authz dependency (verified: no unguarded
  admin endpoint today).
- Negative tests: each role gets 403 on every resource it should not touch (**tests
  [MISSING]** — add RBAC/IDOR suite, see 19).
- All authz-relevant mutations audited with actor_id + IP.
