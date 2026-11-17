# 25 — Risk Register

Severity = Likelihood × Impact. Owner is a role. Status reflects current reality.

| ID | Risk | Sev | Status | Mitigation | Milestone |
|---|---|:--:|---|---|---|
| R1 | **No real SMS/OTP provider** → mobile auth can't work in prod (OTP not delivered) | **High** | Open/Blocked | Integrate DLT SMS provider; keep OTP hardening | P4 |
| R2 | **Payments are a mock** → no real money flow; risk if mistaken for live | **High** | Open | Integrate PSP w/ verified webhooks + idempotency keys | P4 |
| R3 | **Default admin password** (`Admin!Pandit123`) public in repo, not boot-guarded | **High** | Open | Change immediately; add MFA; guard in `validate_runtime` | P0/P1 |
| R4 | **Monitoring blind** (Sentry no DSN) → prod errors invisible | High | Open | Set DSN + alerting | P0 |
| R5 | **Backups unproven** (no run, no restore drill, PITR unknown) | **High** | Open | Run backup, drill restore, enable PITR | P0/P20 |
| R6 | **Rate limiter single-instance** without shared store (fail-open on outage) | Med | Open | Provision Redis; alert on store-down | P0/P1 |
| R7 | **No account deletion / data export** → Play/Apple + DPDP non-compliance | High | Open | Build deletion/export; privacy workflow | P1/P5 |
| R8 | **KYC docs not in private storage** | High | Open | Object storage + signed URLs + access log | P3 |
| R9 | **No maker-checker/MFA on money** → insider/compromise risk | High | Open | Amount thresholds + 2nd approver + step-up | P1/P4 |
| R10 | **No durable workers/queue** → scheduled dispatch, outbox, retries impossible | High | Open | Add queue + worker runtime | P1/P3 |
| R11 | **Concurrency tests run only on SQLite in dev** (skipped) | Med | Partial | Run PG concurrency tests in CI | P1 |
| R12 | **No RBAC/IDOR negative suite** | Med | Open | Add negative authz tests as release gate | P1 |
| R13 | **No load-test evidence** → 100M claim unproven; festival spikes unmodeled | Med | Open | Load/spike/soak tests before scale claims | P8/P10 |
| R14 | **Mobile apps not production-wired** (localhost, AsyncStorage) | Med | Open | Config API base, secure storage, ship pipeline | P5/P6 |
| R15 | **Notifications never delivered** (in-DB only) | Med | Open | Outbox + push/SMS/email | P4 |
| R16 | **No realtime tracking** (poll only) | Low/Med | Open | Realtime channel + throttled GPS | P4/P10 |
| R17 | **No reconciliation** between ledger and PSP | Med | Open | Daily recon + mismatch alerts | P4 |
| R18 | **No staging env / migration pipeline** → risky prod migrations | Med | Open | Staging + gated migrations + backup precondition | P1 |
| R19 | **CMS content XSS** (rich content) | Med | NV | Sanitize/validate CMS HTML; CSP | P2/P7 |
| R20 | **Secret rotation absent** | Med | Open | Secret manager + rotation policy | P1 |
| R21 | **Content delegation gap** (MARKETING can't manage CMS) | Low | Open | Permission registry + CONTENT role | P1/P7 |
| R22 | **Browser/edge cache confusion** on deploys (seen: "old UI") | Low | Known | Document; consider versioned asset/cache strategy | — |

## Top 5 to act on first
R3 (admin password), R4 (monitoring), R5 (backups), R1/R2 (SMS + payments), R6 (Redis).
R3/R4/R5/R6 are mostly **operational config** completing P0; R1/R2 are provider
integrations gating real usage.
