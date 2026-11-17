# 24 — Requirements Traceability

Maps the assignment's requested capabilities → current artifact (evidence) → status →
milestone. Status: I=Implemented, PA=Partial, M=Missing, PR=Proposed, B=Blocked,
NV=Needs-validation.

## Customer app (04)
| Req | Artifact | Status | Milestone |
|---|---|---|---|
| OTP auth | `/mp/auth`, `otp.py` | I (backend) / PA (app) | P1/P5 |
| Address mgmt | `mp_customer_address` | I | — |
| Discovery/catalogue | `/mp/discovery`, `/public` | I | — |
| Instant booking + dispatch | `customer.create_booking`, `dispatch.py` | I | — |
| Scheduled booking | time field; no worker | PA | P2/P3 |
| Pricing/add-ons/coupons | `money.py`; no add-ons/coupons | PA/M | P2 |
| Payment | mock PSP | PA (dev) | P4 |
| Tracking | fields + poll; no realtime | PA | P4/P10 |
| Notifications | `mp_notification`; no transport | PA | P4 |
| Reschedule | — | M | P2/P5 |
| Cancel/refund | cancel + `mp_refund` | I | — |
| Reviews | `mp_review` | I | — |
| Invoices | — | M | P5 |
| Support/dispute | tickets; no dispute struct | PA | P5/P7 |
| Privacy/account deletion | — | M | P1/P5 |
| Device/session mgmt | refresh tokens; no device | PA | P1 |

## Partner app (03)
| Req | Artifact | Status | Milestone |
|---|---|---|---|
| Registration/auth | `onboard`, `/mp/auth` | I/PA | P1/P6 |
| KYC + docs | `mp_verification_document`; no storage | PA | P3 |
| Verification lifecycle | verification-decision, status gates | I | — |
| Capability/zones | `mp_pandit_capability`; radius; no polygons | I/PA | P2 |
| Availability/online | availability + heartbeat; no calendar | I/PA | P2 |
| Offers/accept/dispatch | `mp_dispatch_attempt`, atomic accept | I | — |
| GPS/navigation | location post; no stream/nav | PA | P4/P10 |
| Service execution/completion | status advance | I | — |
| Earnings/commission/ledger | `mp_ledger_entry` | I | — |
| Payout + bank verify | payout (admin); no bank entity | PA/M | P3/P4 |
| Notifications/support | in-DB; tickets | PA | P4/P6 |
| Suspension | enforced | I | — |
| Secure device mgmt | tokens; no secure storage | PA | P1/P6 |

## Admin CRM (04)
| Module | Artifact | Status | Milestone |
|---|---|---|---|
| Exec dashboard | ops dashboard counts | PA | P7 |
| Customer CRM | customers directory | PA | P7 |
| Partner CRM | partners + verification | I (core) | — |
| Booking ops | bookings + reassign | I (core) | — |
| Dispatch board | manual reassign only | PA | P3/P7 |
| Finance | payments/refund/payout/ledger (audited) | I (core) | — |
| Support | tickets | I (core) | — |
| Website CMS | full CMS + revalidate | I | — |
| Staff mgmt UI | roles in code only | PA | P1/P7 |
| Analytics | none | M | P7 |
| Security/audit viewer | audit_log; no UI | PA | P7 |

## Platform (06–21)
| Req | Artifact | Status | Milestone |
|---|---|---|---|
| Modular monolith | FastAPI app | I | — |
| RBAC deny-by-default | `require_admin/staff` | I | — |
| ABAC/maker-checker/MFA | — | M | P1/P4 |
| Append-only ledger + audit | `mp_ledger_entry`, `audit_log` | I | — |
| Idempotent money | webhook/ledger; no keys | PA | P1/P4 |
| Rate limiting | pluggable limiter | I | — |
| OTP hardening | keyed HMAC | I | — |
| Signed webhooks | mock signed | I (dev) | P4 |
| Realtime | poll only | PA | P4/P10 |
| Notifications transport | none | M | P4 |
| Object storage | none | M | P3 |
| Redis/queue/workers | none | M | P1/P3 |
| Monitoring | Sentry wired, no DSN | PA | P0 |
| Backups/PITR/restore drill | script+workflow; not run | PA | P0 |
| Privacy/DPDP/retention | partial | PA/M | P1/P5 |
| 100M scale | targets only, no load test | NV | P10 |
| Load/perf/security tests | partial | PA/M | P8 |

## Coverage summary
Marketplace **core transactional spine** (auth, booking, dispatch, finance, audit, CMS,
admin) is **Implemented**. The major build areas are: real **PSP + notifications +
object storage + workers/queue + realtime** (integrations), **mobile app productionization**,
**ABAC/MFA/maker-checker**, **analytics**, and **scale/test evidence**.
