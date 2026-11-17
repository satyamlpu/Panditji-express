# 22 — Admin Permission Matrix

Roles (current): **SUPER_ADMIN** (`admin`), **OPS**, **VERIFICATION**, **FINANCE**,
**SUPPORT**, **MARKETING**. Super-admin is always allowed. Content (CMS) routes are
currently **super-admin only** (`require_admin`); marketplace mutations are
role-scoped (`require_staff`). ✅ = allowed, ✗ = denied (403), **◐** = target/not-yet.

## Current enforced matrix (verified)
| Resource / action | SUPER | OPS | VERIF | FIN | SUPPORT | MKTG |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| CMS: services/categories/pages/FAQs/… (CRUD, publish) | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ |
| CMS: media, settings, SEO | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Enquiries (read/update) | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Partners: list/detail | ✅ | ✗ | ✅ | ✗ | ✗ | ✗ |
| Partners: verification-decision | ✅ | ✗ | ✅ | ✗ | ✗ | ✗ |
| Bookings: list/detail | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Bookings: reassign | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Ops dashboard | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Finance: payments/ledger/summary | ✅ | ✗ | ✗ | ✅ | ✗ | ✗ |
| Finance: refund | ✅ | ✗ | ✗ | ✅ | ✗ | ✗ |
| Finance: payouts | ✅ | ✗ | ✗ | ✅ | ✗ | ✗ |
| Reviews: moderate | ✅ | ✗ | ✗ | ✗ | ✅ | ✗ |
| Support: tickets (assign/reply/status) | ✅ | ✗ | ✗ | ✗ | ✅ | ✗ |

Notes: every mutation above writes `audit_log` (actor_id + IP where applicable).
MARKETING currently has **no** usable surface (content is super-admin-only) — a gap.

## Target matrix (additions) [PROPOSED]
| Resource / action | SUPER | OPS | VERIF | FIN | SUPPORT | MKTG | CONTENT |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| CMS content (non-destructive edit) | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ |
| CMS publish | ✅ | ✗ | ✗ | ✗ | ✗ | ◐ | ✅ |
| Refund/payout **above threshold** | ✅(approve) | ✗ | ✗ | ✅(create) | ✗ | ✗ | ✗ |
| Staff/role management | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Audit/security viewer | ✅ | ◐(ops subset) | ✗ | ◐(fin subset) | ✗ | ✗ | ✗ |
| Analytics (read) | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ | ◐ |

## ABAC overlays to add (see 10/11) [PROPOSED]
- **Amount threshold + maker-checker:** refund/payout over ₹X needs a second approver
  (separation of duties: creator ≠ approver).
- **Geographic scoping:** OPS/SUPPORT limited to assigned region(s).
- **Property-level:** mask bank/KYC fields except for the role that needs them.
- **Step-up auth:** refund/payout/suspend/role-change require re-auth (MFA).
- **Break-glass:** time-boxed elevated access, fully audited, auto-expires.

## Rules
1. **Deny-by-default** — any resource/action not explicitly allowed is denied.
2. **CMS ≠ Finance ≠ Ops** permissions (separation preserved).
3. **Every allow is testable** — negative RBAC tests assert the ✗ cells (see 19).
4. **Super-admin is minimal-use** — day-to-day work uses scoped roles; super-admin
   actions are audited + ideally MFA-gated.
