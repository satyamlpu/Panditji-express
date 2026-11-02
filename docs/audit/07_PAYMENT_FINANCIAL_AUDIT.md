# 07 — Payment & Financial Audit

Code: `app/marketplace/finance.py`, `routers/payments.py`, `routers/admin_finance.py`, models `mp_payment/mp_ledger_entry/mp_refund/mp_payout`. **No real payments were initiated during this audit.**

## Gateway & flow
- **Mock gateway with a production-shaped trust boundary.** `/api/v1/mp/payments/webhooks/mock` is the trusted confirmation path; `/mock/pay` is a dev simulator **correctly disabled in production** (`routers/payments.py:55-56`, `settings.is_production`). The client `pay` endpoint only *creates an order* and never marks paid (`customer.py:413-436`) — confirmation is webhook-driven. A real gateway (e.g., Razorpay) is a drop-in: the verify → idempotency → ledger flow stays the same.
- **Money is integer paise everywhere** (`mp_payment.amount_paise`, `mp_ledger_entry.amount_paise`, `service.price_paise`). Only transient floats are the `round()` inputs in `commission_split`, cast back to int. **No float money columns.** ✅
- **Commission** (`finance.commission_split`): `gateway_fee = round(amount*2%)`, `commission = round(amount*15%)` (from `config.py:65-66`), `partner_payable = amount − fee − commission` (exact integer subtraction; residual rounding goes to the partner, so no paise created/lost). ✅

## Webhook security & idempotency
- **Signature: HMAC-SHA256 over the raw body, constant-time compare** (`finance.verify_signature:47-54`, called with the raw request body in `payments.py:32-33`); empty signature rejected. ✅
- **Idempotency: safe single-threaded, UNSAFE under concurrency.** Dup guard = unique `provider_payment_id` + `status==PAID` early return (`finance.py:101-125`). Two **concurrent** duplicate webhooks both pass the dup-SELECT before either commits and both post the 4 ledger rows → **double-credit** (no `with_for_update` on the payment row, no unique "ledger-per-payment-event"). **[HIGH, R2]**

## Ledger, refunds, payouts
- **Ledger append-only for amounts** (`mp_ledger_entry`): charge/fee/commission/payable, refund, payout rows are only inserted, never amount-updated or deleted. The `settled`/`payout_id` **flags** are mutated in place during payout (`finance.py:298-300`) — so "append-only" holds for money, not the settlement flag. No admin endpoint updates/deletes any financial row (`admin_finance.py` has only GET/refund/payout). **Financial rows are not admin-mutable.** ✅
- **Refund** (`create_refund:185-248`): only on PAID/PARTIALLY_REFUNDED, bounded by remaining, posts a REFUND ledger row, flips status; admin refund requires a reason and is audited. **Racy** (concurrent refunds both pass the remaining check → over-refund). **[HIGH, R3]**
- **Payout** (`process_payout:271-322`): sums unsettled PARTNER_PAYABLE, writes a `Payout` + PAYOUT ledger row, marks entries settled. Correct accounting but **racy** (concurrent payouts double-pay). **[HIGH, R3]**
- **Reconciliation gap (NOT VERIFIED as a concrete bug):** `summary` computes `outstanding_payable = payable − paid_out` and does **not** subtract refunds from partner payable (refunds tracked as a separate total). If a refunded booking's partner-payable is still owed, a partner could be paid on a refunded transaction. Flag for reconciliation review.

## State-consistency
- **Payment can diverge from booking state** (`R6`): pay is allowed in any ASSIGNED/completed state; `cancel_booking` never touches payments → a cancelled, captured booking stays `paid` until a manual admin refund. No invariant couples the two.

## Configuration / secrets
- **[HIGH] Prod can run with the default `payment_webhook_secret`.** `validate_runtime()` enforces only `jwt_secret`, not `payment_webhook_secret` (default `"dev-mock-payment-secret"`, `config.py:64`) nor `revalidate_secret`. If left default in prod, an attacker knowing the public default can sign a body that passes verification and POST the webhook to mark any booking PAID + post partner-payable ledger entries. **Remediation:** extend `validate_runtime()` to reject both default secrets in production.

## Is the financial record auditable? — Mostly yes
Append-only ledger + immutable amounts + booking-event log + admin audit on refunds give a solid audit trail. Gaps: concurrency double-posts (R2/R3) could corrupt totals; refund-vs-payable reconciliation is incomplete; no FK on `ledger.payout_id` (see `04`).

## Remediation priorities
1. Enforce non-default webhook/revalidate secrets in `validate_runtime()` (HIGH).
2. Lock the payment row (`SELECT … FOR UPDATE`) in `record_paid`/`create_refund`; add a unique constraint for "one ledger set per payment event"; lock/serialize `process_payout` per pandit (HIGH).
3. Add a unique constraint for an open payment per booking (fixes `create_order` double-insert).
4. Couple payment↔booking state: auto-refund (or block) on post-capture cancellation; add a reconciliation job (include refunds in payable).
5. When integrating the real gateway, keep the raw-body HMAC verification and move the webhook secret to a managed secret store.
