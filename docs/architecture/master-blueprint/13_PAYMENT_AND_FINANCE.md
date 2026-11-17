# 13 — Payment & Finance

## Money model (current) [IMPLEMENTED] — append-only ledger
- **Entities:** `mp_payment`, `mp_ledger_entry` (append-only), `mp_refund`, `mp_payout`.
- **Ledger entry types:** `customer_charge`, `gateway_fee`, `platform_commission`,
  `partner_payable`, `refund`, `payout`. Every money movement is a ledger row; balances
  are derived, never mutated in place.
- **Amounts in paise** (integer) — no float money.

## Payment flow (current) [PARTIAL / DEV]
```
create order → customer "pays" (mock) → SIGNED webhook → record_paid
   → posts: customer_charge, gateway_fee, platform_commission, partner_payable
```
- Webhook is **HMAC-signed** and **idempotent** (duplicate webhook = one charge set;
  `test_webhook_idempotent`). A client call can never self-confirm payment
  (`test_payment_requires_signed_webhook`).
- **Gap:** this is a **mock** gateway (`/payments/mock/pay`, `/payments/webhooks/mock`).
  **Real PSP integration is [MISSING]** — must replace with provider (Razorpay/PhonePe/
  Cashfree/etc.): server-created order, client SDK, **server-verified** webhook signature,
  idempotency keys, settlement reconciliation.

## Refunds (current) [IMPLEMENTED]
- `finance.create_refund`: locks payment row (`refresh … FOR UPDATE`), validates state +
  amount (1..remaining), posts refund ledger entry, updates payment status
  (REFUNDED/PARTIALLY_REFUNDED), notifies customer, **audited** (actor_id + IP).
- Guards against **over-refund** under concurrency (row-lock + refresh).

## Payouts (current) [IMPLEMENTED]
- `finance.process_payout`: locks unsettled `partner_payable` rows (`FOR UPDATE`), sums,
  creates `mp_payout`, marks entries settled, posts payout ledger, notifies pandit,
  **audited**. Prevents double-payout (loser sees nothing due).
- **Gap:** no **bank-account entity / verification (penny-drop)**; no self-service payout
  request; no PSP payout rail integration — payout is a ledger/record action only.

## Idempotency & transactional safety (rule #16)
| Op | Idempotent? | Transactional? |
|---|---|---|
| Pay webhook | ✅ | ✅ |
| Refund | ⚠️ (no client key; row-locked) | ✅ |
| Payout | ⚠️ (no client key; row-locked) | ✅ |
| Booking create | ⚠️ [NEEDS-VALIDATION] | ✅ |
**Target:** `Idempotency-Key` on every money-mutating POST; dedup table
(`idempotency_key`) returning the first result on retry.

## Controls — gaps [MISSING → PROPOSED]
1. **Reconciliation:** daily match ledger ↔ PSP settlement report; flag mismatches.
2. **Maker-checker:** refunds/payouts above a ₹ threshold need a second approver;
   separation of duties (creator ≠ approver). Record approvals in `audit_log` + an
   `approval` row.
3. **Financial reports/export:** finance summary exists; add period reports, GST/tax
   fields if required [NEEDS-VALIDATION with finance/legal].
4. **Chargebacks/disputes** handling.
5. **Commission config** (per-service/per-tier) — currently fixed logic.

## Failure & recovery
| Scenario | Behavior |
|---|---|
| Payment captured, dispatch failed | refund path + ops queue (manual today) |
| Webhook retried | idempotent — safe |
| Refund during payout | append-only ledger + settled flags reconcile; row-locks serialize |
| PSP webhook spoofed | rejected (signature) |
| Partial refunds summing to full | status→REFUNDED at full |

## Acceptance criteria
- No money mutation without an audit row (verified: one row per action, atomic).
- No float arithmetic; all paise integers.
- Over-refund and double-payout impossible under concurrency (row-locks + tests).
- Real-PSP: no state change except on a server-verified signed event.
