# Audit-Log Integrity Review

**P0 change:** added `audit()` calls in `admin.reassign` (`admin.py:292`),
`admin_finance.refund` (`admin_finance.py:142`), `admin_finance.process_payout`
(`admin_finance.py:189`).
**Service:** `app/services/audit.py` → `AuditLog` model (`app/models/audit.py`),
table `audit_log` created in migration `925cc5311b6c_initial_schema.py:38`.

## Mechanism (verified)

`audit(session, *, action, actor_id, actor_email, entity, entity_id, ip, meta)`
adds an `AuditLog` row and `await session.flush()` — **no commit of its own**
(`audit.py:21`). The `audit_log` table is append-only (no update/delete paths).
The model carries `action` (indexed), `actor_id`, `actor_email`, `entity`,
`entity_id`, `ip`, `meta` (JSON), plus `Timestamps` (created_at).

## Transaction consistency (verified — GOOD)

- `get_session` (`app/db/session.py`) runs **one** transaction per request:
  `yield` → `commit()` on success, `rollback()` on any exception.
- Grep confirms **no service calls `session.commit()` internally** (`finance.py`,
  `dispatch.py`, `services/`). So the business mutation and its audit row flush
  into the *same* transaction and commit together.
- Therefore: if `audit()` fails, the **whole request rolls back** (the refund/
  payout/reassign is undone); if the mutation fails first, no audit row is
  written. **No split-brain** — a mutation cannot succeed while its audit fails,
  nor vice-versa. This is the correct, safe design.

## Finding A‑1 — the P0 additions DUPLICATE existing audit entries (MEDIUM) — CONFIRMED

The premise in `docs/P0_HARDENING.md` ("these mutations … wrote **no** central
audit entry") is **factually wrong**. The service layer already audits all three:

| Mutation | Pre-existing service audit | P0-added router audit | Result |
|---|---|---|---|
| Refund | `finance.create_refund` → `audit(action="mp.payment.refund", entity="payment", entity_id=payment.id, meta={amount_paise, reason})` (`finance.py:240`) | `audit(action="mp.finance.refund", actor_id, ip, entity="payment", meta={amount_paise, reason})` (`admin_finance.py:142`) | **2 rows / refund**, different `action` strings |
| Payout | `finance.process_payout` → `audit(action="mp.payout.process", entity="payout", entity_id=payout.id, meta={pandit_id, amount_paise})` (`finance.py:321`) | `audit(action="mp.finance.payout", actor_id, ip, entity="pandit", entity_id=pandit_id, meta={amount_paise, bookings})` (`admin_finance.py:189`) | **2 rows / payout**, different `action` *and* `entity` taxonomy |
| Reassign | `dispatch.manual_reassign` → `audit(action="mp.booking.reassign", entity="booking", entity_id=booking.id, meta={to_pandit})` (`dispatch.py:599`) | `audit(action="mp.booking.reassign", actor_id, ip, entity="booking", meta={pandit_id, reason})` (`admin.py:292`) | **2 rows / reassign with the *identical* `action` string** |

(`MpAudit.REFUND="mp.payment.refund"`, `PAYOUT="mp.payout.process"`,
`MANUAL_REASSIGN="mp.booking.reassign"` — `marketplace/constants.py:172-177`.)

**Impact:**
- Every refund, payout, and reassign now writes **two** `audit_log` rows. Any
  compliance/reporting query that *counts* financial actions will double-count.
- The action taxonomy is now inconsistent: refunds appear under both
  `mp.payment.refund` and `mp.finance.refund`; payouts under `mp.payout.process`
  and `mp.finance.payout`; the payout's `entity` is `"payout"` in one row and
  `"pandit"` in the other. For reassign the two rows share the exact action
  string and differ only by presence of `ip`/`actor_id`/`reason` — nearly
  indistinguishable duplicates.
- This is an **audit-trail integrity defect in a money system**, not merely
  cosmetic. It is not a security hole (both rows are truthful; append-only), and
  there is no data-loss risk.

**The one real gap the P0 change exposes:** the *service-layer* audit rows omit
`actor_id` (UUID) and `ip`; they carry only `actor_email`. That is the single
piece of added value in the router version.

**Recommendation (fix before merge):** remove the three router-level `audit()`
calls and instead **enrich the existing service-layer calls** — thread the
admin's `actor_id` and client `ip` into `finance.create_refund` /
`finance.process_payout` / `dispatch.manual_reassign` and pass them to their
existing `audit()` invocations. That delivers the actor_id/ip improvement with
**one** row per action and a consistent taxonomy. Update `docs/P0_HARDENING.md`
§4 to reflect the corrected rationale.

## Finding A‑2 — audit coverage of other sensitive mutations (INFO)

Independent grep of all `await audit(` call sites shows broad pre-existing
coverage: payment order/verify (`finance.py:86/171`), dispatch offer/accept/
reject/status/cancel (`dispatch.py`), verification-decision (`admin.py:152`),
review moderation (`admin_finance.py:259`), ticket assign/reply/status
(`admin_support.py`), OTP request/login (`auth.py`), plus all content CMS
mutations (`app/api/routers/admin_*.py`). **No sensitive mutation was found that
lacks an audit entry.** (This further undermines A‑1's premise — the audit
coverage was already comprehensive.)

## Finding A‑3 — `meta` / PII content (LOW)

`meta` carries `amount_paise`, `reason` (free-text admin input), `pandit_id`,
`bookings`. No secrets, tokens, phone numbers or card data. `reason` is
admin-entered operational text (acceptable in an audit log). `ip` is recorded.
No PII concern.

## Area status: **PASS WITH CONDITIONS**
Transaction consistency and append-only integrity are correct (no split-brain).
**Condition (should fix before merge):** the P0 additions duplicate existing
audit rows and fragment the action taxonomy (A‑1). Replace the three router
`audit()` calls with enrichment (actor_id + ip) of the existing service-layer
calls, and correct the §4 rationale.
