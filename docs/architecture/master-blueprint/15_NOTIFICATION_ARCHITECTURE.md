# 15 — Notification Architecture

## Current state [PARTIAL]
- **In-DB notifications** exist: `mp_notification` written by `marketplace/notify.py`
  (`notify_customer`, `notify_pandit`) on events (booking confirmed, refund, payout,
  reassign, etc.). Read via `GET /mp/{customer|partner}/notifications` +
  `read-all`. **[IMPLEMENTED]**
- **Gap:** no **delivery transport** — nothing is actually pushed to a device, phone, or
  inbox. **Push (FCM/APNs), SMS, email, WhatsApp are [MISSING]**.

## Target architecture [PROPOSED] — outbox + channels
```
domain event ─▶ write mp_notification (in-app)  ─┐
             ─▶ write OUTBOX row (channel, payload, dedup key)
                         │ (durable worker, at-least-once + idempotent)
          ┌──────────────┼───────────────┬───────────────┐
        FCM/APNs        SMS (DLT)       Email            WhatsApp
       (push_token)   (OTP + txn)    (receipts)        (optional)
```
- **Outbox pattern:** every external notification is a row committed **in the same
  transaction** as the domain change, then dispatched by a worker → exactly-once effect
  via dedup keys, retries with backoff, dead-letter.
- **Device tokens:** new `push_token` table (principal, platform, token, last-seen);
  registration endpoint for the apps [MISSING].
- **SMS/DLT (India):** OTP + transactional templates require **DLT registration** and a
  provider (MSG91/Gupshup/Twilio/Kaleyra). **[BLOCKED]** on business/provider setup —
  this also unblocks real mobile OTP auth.
- **Preferences:** per-channel opt-in/opt-out; quiet hours; locale (Hindi/English).

## Channel matrix (target)
| Event | In-app | Push | SMS | Email |
|---|---|---|---|---|
| OTP | — | — | ✅ (DLT) | — |
| Booking confirmed | ✅ | ✅ | optional | receipt |
| Pandit assigned / en route | ✅ | ✅ | — | — |
| Payment/refund | ✅ | ✅ | optional | ✅ receipt |
| Payout processed | ✅ | ✅ | — | ✅ |
| Offer (partner) | ✅ | ✅ (high-pri) | — | — |
| Support reply | ✅ | ✅ | — | optional |

## Throughput & scale (17 has the model)
- OTP + offer pushes are latency-sensitive and spiky; size the worker + provider rate
  limits accordingly. Push fan-out is cheap; SMS has cost + provider throughput caps.
- Idempotency + rate limiting per recipient to avoid spam loops.

## Failure & recovery
| Scenario | Behavior |
|---|---|
| Provider down | outbox retries + dead-letter; in-app still works |
| Invalid/expired device token | prune on provider error |
| Duplicate event | dedup key → single send |
| User opted out | skip channel, keep in-app |

## Acceptance criteria
- No notification side-effect lost on crash (outbox committed with the tx).
- No duplicate external send for one event.
- OTP/SMS via DLT-approved templates only; no secrets/PII in logs.
