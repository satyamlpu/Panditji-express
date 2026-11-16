# 11 — Payment & Financial Audit

`app/marketplace/finance.py` (ledger, refunds, payouts) + `routers/payments.py` (provider interface). Provider-agnostic behind an HMAC webhook; **currently mock only**.

## Money flows (verified in code)
| Flow | State | Evidence |
|---|---|---|
| Create order / payment intent | ⚙️ mock | `payments.py` `payments/mock/pay` |
| Webhook verification | ✅ | HMAC-SHA256 over body with `payment_webhook_secret` (`finance.py:48`) |
| Mark paid (ledger) | ✅ | `record_paid` locks order row |
| Refund | ✅ VERIFIED | `create_refund` uses `session.refresh(payment, with_for_update=True)` — over-refund race fixed + tested |
| Payout to pandit | ✅ | `process_payout` locks unsettled ledger entries `.with_for_update()` |
| Open-payment invariant | ✅ | `uq_payment_open_per_booking` (one open payment per booking) |
| Secret guard | ✅ | prod rejects default `PAYMENT_WEBHOOK_SECRET` (`config.validate_runtime`) |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| **F-1** | **CRITICAL (for go-live)** | **No real payment gateway** — cannot take real money; `mock/pay` only. Needs Razorpay/UPI/etc. with real idempotency, 3DS, settlement reconciliation | `payments.py` |
| F-2 | HIGH | No **idempotency keys** against a real gateway / no stored provider event dedupe table beyond the open-payment unique | `finance.py`, models |
| F-3 | HIGH | Finance reconciliation & payout **admin UI is thin** — money ops would be manual/opaque | 07 A-4, `admin_finance.py` |
| F-4 | MEDIUM | No **audit trail surfaced** for financial mutations (an `audit()` service exists — ensure every money mutation writes it) | `app/models/audit.py` |
| F-5 | MEDIUM | No tax/GST/invoice generation | not present |
| F-6 | LOW | Commission/fee policy is code-level, not configurable per category/zone | finance logic |

## Strengths
The **concurrency-critical money paths** (paid, refund, payout) are **row-locked and tested**, including the specific over-refund race that was caught and fixed. Webhook HMAC + secret guard are in place. The provider boundary is clean, so wiring a real gateway is additive.

## Classification
Finance core: **IMPLEMENTED + concurrency-hardened.** Payment acceptance: **NOT PRODUCTION-READY** (mock provider, F-1) — the gating item before real transactions, alongside reconciliation UI and idempotency.
