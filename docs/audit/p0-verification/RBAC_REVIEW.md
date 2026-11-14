# RBAC & Authorization Review

**Scope:** independent inspection of all admin/staff endpoints and the
dependency machinery. (RBAC was not substantially changed by P0; this verifies
the P0 doc's *correction* to the earlier platform audit.)

## Machinery (verified)

- `get_current_admin` (`app/api/deps.py`) decodes the JWT, then **re-resolves the
  admin from the DB every request** and re-checks `status == ACTIVE`. Role/status
  are never trusted from the token. Verified. This means suspension and role
  changes take effect immediately.
- `require_admin` (`deps.py`) — deny-by-default; allows only `Role.ADMIN`
  (`"admin"`, i.e. super-admin). Used by all **content/CMS** routers.
- `require_staff(*roles)` (`principals.py:116`) — `allowed = set(roles) |
  {SUPER_ADMIN}`; raises `ForbiddenError` if `admin.role not in allowed`. Used
  per-endpoint by all **marketplace** admin routers. Super-admin is always
  allowed; each staff role is otherwise scoped to its own routes.
- Customers/pandits carry a separate `kind`-scoped token (`principals.py`) and
  cannot resolve as admin; a suspended pandit keeps a token but is rejected at
  `get_current_pandit` (`principals.py:105`).

## Route-level authorization matrix (marketplace admin)

| Endpoint | Method | Required role | Dep | Audited? |
|---|---|---|---|---|
| `/mp/admin/pandits` | GET | VERIFICATION (+super) | `_verify` admin.py:88 | n/a (read) |
| `/mp/admin/pandits/{id}` | GET | VERIFICATION | admin.py:113 | n/a |
| `/mp/admin/pandits/{id}/verification-decision` | POST | VERIFICATION | admin.py:132 | ✅ admin.py:152 |
| `/mp/admin/bookings` | GET | OPS | admin.py:182 | n/a |
| `/mp/admin/bookings/{id}` | GET | OPS | admin.py:196 | n/a |
| `/mp/admin/bookings/{id}/reassign` | POST | OPS | admin.py:271 | ✅ (×2 — see A‑1) |
| `/mp/admin/dashboard` | GET | OPS | admin.py:307 | n/a |
| `/mp/admin/finance/summary` | GET | FINANCE | admin_finance.py:68 | n/a |
| `/mp/admin/finance/payments` | GET | FINANCE | admin_finance.py:75 | n/a |
| `/mp/admin/finance/payments/{id}/ledger` | GET | FINANCE | admin_finance.py:87 | n/a |
| `/mp/admin/finance/payments/{id}/refund` | POST | FINANCE | admin_finance.py:124 | ✅ (×2 — A‑1) |
| `/mp/admin/finance/payouts` | GET | FINANCE | admin_finance.py:157 | n/a |
| `/mp/admin/finance/payouts` | POST | FINANCE | admin_finance.py:181 | ✅ (×2 — A‑1) |
| `/mp/admin/reviews` | GET | SUPPORT | admin_finance.py:231 | n/a |
| `/mp/admin/reviews/{id}/moderate` | POST | SUPPORT | admin_finance.py:246 | ✅ admin_finance.py:259 |
| `/mp/admin/tickets` | GET | SUPPORT | admin_support.py:66 | n/a |
| `/mp/admin/tickets/{id}` | GET | SUPPORT | admin_support.py:79 | n/a |
| `/mp/admin/tickets/{id}/assign` | POST | SUPPORT | admin_support.py:88 | ✅ :96 |
| `/mp/admin/tickets/{id}/reply` | POST | SUPPORT | admin_support.py:112 | ✅ :118 |
| `/mp/admin/tickets/{id}/status` | POST | SUPPORT | admin_support.py:134 | ✅ :149 |

**Content/CMS routers** (`app/api/routers/admin_*.py`): every one declares
`dependencies=[Depends(require_admin)]` at the router level *and* each mutation
re-takes `admin: CurrentAdmin = Depends(require_admin)`. Verified across
services, categories, locations, testimonials, faqs, pages, banners, media,
settings, enquiries. **No ungated admin endpoint was found.**

## Conceptual role tests

| Actor | Content routes | Finance POST | Ops reassign | Verification | Support |
|---|---|---|---|---|---|
| Unauthenticated | 401 | 401 | 401 | 401 | 401 |
| Customer / Pandit token | 401 (wrong `kind`/no admin) | 401 | 401 | 401 | 401 |
| SUPPORT staff | 403 | 403 | 403 | 403 | ✅ |
| OPS staff | 403 | 403 | ✅ | 403 | 403 |
| VERIFICATION staff | 403 | 403 | 403 | ✅ | 403 |
| FINANCE staff | 403 | ✅ | 403 | 403 | 403 |
| SUPER_ADMIN (`admin`) | ✅ | ✅ | ✅ | ✅ | ✅ |

Least privilege holds: a FINANCE admin cannot reach OPS/VERIFICATION/SUPPORT
routes and vice-versa; super-admin is the only cross-cutting role.

## Findings

### RB‑1 — the earlier audit's "RBAC not enforced" was overstated — CONFIRMED (INFO)
Verified independently: RBAC **is** enforced, per-endpoint, deny-by-default, with
DB-resolved roles. The P0 doc's correction (A‑1/S‑3) is accurate.

### RB‑2 — object-level authorization is role-scoped, not owner-scoped (INFO, correct)
Admin tooling acts across all resources by role; there is no per-object owner
check, which is correct for staff tooling (an OPS agent reassigns *any* booking).
Resource ids are validated (`NotFoundError` on bad id). No IDOR: a staff member
cannot escalate by id manipulation because the role gate, not ownership, governs
access, and customers/pandits can't reach these routes at all.

### RB‑3 — content CMS has no delegation (LOW, feature gap not a hole)
All CMS mutation is super-admin-only (`require_admin` = `Role.ADMIN`). The
`MARKETING`/content staff roles cannot manage content. This is a missing feature
(deferred to P4 per the P0 doc), **not** a privilege-escalation risk.

### RB‑4 — no automated 403 cross-role denial tests (LOW)
The matrix above is verified by inspection; there is no test asserting that, e.g.,
a SUPPORT token gets 403 on a finance refund. Recommend adding a small
parametrised authorization test. See `TEST_EVIDENCE.md`.

## Area status: **PASS**
Authorization is correctly enforced at every admin/staff endpoint, deny-by-default,
with live DB role resolution and no IDOR. Add cross-role denial tests (RB‑4) and,
later, content delegation (RB‑3).
