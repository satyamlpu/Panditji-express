# 21 — Privacy & Data Governance

Operating in India → align with the **Digital Personal Data Protection Act (DPDP) 2023**
and app-store requirements (Google Play / Apple). **No compliance is claimed**; this is
the governance design + current gaps. Legal review required **[NEEDS-VALIDATION]**.

## Personal data inventory (current)
| Data | Where | Sensitivity |
|---|---|---|
| Phone number | `mp_customer`, `mp_pandit`, `mp_otp_code`, enquiries | PII (identifier) |
| Name, language | customer/pandit | PII |
| Address + geo | `mp_customer_address`, booking location | PII (location) |
| Live GPS | tracking fields/events | sensitive (location) |
| KYC documents | `mp_verification_document` | **sensitive** (ID) |
| Payment/ledger | `mp_payment`, `mp_ledger_entry`, refunds, payouts | financial |
| Reviews, support messages | `mp_review`, tickets | PII/free-text |
| Audit (actor + IP) | `audit_log` | operational PII |

## Current controls [IMPLEMENTED / PARTIAL]
- Sentry `send_default_pii=False` (PII not sent to monitoring). [IMPLEMENTED]
- OTP hashed (keyed); passwords argon2; no secrets in logs. [IMPLEMENTED]
- TLS in transit; Supabase encryption at rest. [IMPLEMENTED/NEEDS-VALIDATION]
- Audit trail of staff access to sensitive actions. [IMPLEMENTED]

## Gaps vs DPDP / stores [MISSING]
| Requirement | Status |
|---|---|
| **Consent** capture + purpose limitation | [MISSING] |
| **Privacy policy** surfaced in apps (page exists on web) | [PARTIAL] |
| **Account deletion** (user-initiated) + data erasure | [MISSING] (Play/Apple require it) |
| **Data export** (user access request) | [MISSING] |
| **Retention policy** + automated purge (GPS, OTP, events, closed tickets) | [MISSING] |
| **KYC document** private storage + signed URLs + access log | [MISSING] |
| **Data minimization** review | [PARTIAL] |
| **Grievance officer / DPO** + request workflow | [MISSING] (DPDP) |
| **Breach notification** process | [MISSING] |
| **Children / consent-manager** nuances | [NEEDS-VALIDATION] |
| **Cross-border transfer** rules (if international later) | [NEEDS-VALIDATION] |

## Retention design [PROPOSED]
| Data | Retention |
|---|---|
| OTP codes | purge after expiry (minutes) |
| Raw GPS points | 7–30 days, then aggregate/drop |
| Booking/ledger/audit (financial) | long (legal/tax) — do **not** hard-delete |
| Closed support tickets | policy-based (e.g. 1–2 yr) |
| KYC docs | per regulation; access-logged; purge on offboarding per policy |
| Deleted accounts | erase PII, retain financial records pseudonymized for legal |

## Secure deletion
Account deletion must **erase/pseudonymize PII** while preserving immutable financial +
audit records (legal) — design a `delete_request` workflow (soft-lock → erase PII →
retain ledger with pseudonymized actor). [PROPOSED]

## Access governance
- Least-privilege DB + cloud; periodic access reviews; staff actions on PII audited;
  KYC/document access logged. [PARTIAL → PROPOSED]

## Acceptance criteria
- No PII in logs/monitoring/URLs (verified for Sentry; keep as a gate).
- Account deletion + data export shipped before public mobile launch (store requirement).
- Retention jobs run; KYC behind signed URLs with access logging.
- DPDP obligations reviewed by legal before scale.
