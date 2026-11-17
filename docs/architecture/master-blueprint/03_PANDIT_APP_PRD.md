# 03 — Panditji Partner App PRD (Android + iOS)

**Current state:** `pandit-app/` — Expo SDK 58 / RN 0.88 / expo-router. Screens:
`(tabs)/index|jobs|earnings|profile`, `job/[id]`, `login`, `onboard`, `index`.
**[PARTIAL]** — `API_BASE` hardcoded to `localhost:8099`; **not deployed**. Backs onto
the live `/api/v1/mp/partner` contract. A working skeleton, not a shipped app.

## Target users & roles
- **Applicant pandit** (registered, pre-verification) → **Verified/approved partner**
  → states: online/offline, busy, suspended. One principal type (`mp_pandit`) with a
  **status lifecycle** (below).

## Partner lifecycle & allowed transitions [IMPLEMENTED backend]
```
SUBMITTED ──verify──▶ APPROVED ──(ops)──▶ SUSPENDED ──reinstate──▶ APPROVED
    │                     │
    └──reject──▶ REJECTED │
Availability (orthogonal, only when APPROVED): OFFLINE ⇄ ONLINE ⇄ BUSY
```
- Enforced: `get_current_pandit` blocks SUSPENDED; dispatch only offers to APPROVED +
  ONLINE + capable + fresh-heartbeat pandits (`dispatch.py`). Verification decision in
  `admin.verification_decision`. **State-transition tests exist (concurrency suite).**
- **[NEEDS-VALIDATION]** full transition guard table (e.g. REJECTED→APPROVED path).

## Feature set (requested 1–36) with status

| # | Feature | Status | Evidence / gap |
|---|---|---|---|
| 1 | Registration | [PARTIAL] | `onboard.tsx`; applicant row created |
| 2 | Authentication | [IMPLEMENTED] | phone+OTP (`/mp/auth`, kind=pandit) |
| 3 | Profile | [IMPLEMENTED] | `mp_pandit` + profile tab |
| 4 | KYC | [PARTIAL] | `mp_verification_document` table; upload/review flows thin |
| 5 | Document upload | [PARTIAL] | model exists; storage (object store + signed URLs) [MISSING] |
| 6 | Verification | [IMPLEMENTED] | verification-decision endpoint, audited |
| 7 | Approval/rejection | [IMPLEMENTED] | status transitions + reason |
| 8 | Service expertise | [IMPLEMENTED] | `mp_pandit_capability` |
| 9 | Languages | [PARTIAL] | field exists; matching partial |
| 10 | Service zones | [PARTIAL] | geo radius (`service_radius_km`) + PostGIS; polygon zones [MISSING] |
| 11 | Availability calendar | [MISSING] | only online/offline now |
| 12 | Online/offline status | [IMPLEMENTED] | availability + heartbeat |
| 13 | Booking offers | [IMPLEMENTED] | `mp_dispatch_attempt` OFFERED |
| 14 | Offer expiry | [IMPLEMENTED] | 60s TTL dispatch |
| 15 | Accept/reject | [IMPLEMENTED] | `accept_offer`/`reject_offer` (atomic) |
| 16 | Dispatch | [IMPLEMENTED] | ranked nearest-eligible |
| 17 | Assignment | [IMPLEMENTED] | `assigned_pandit_id`, availability→BUSY |
| 18 | Navigation | [MISSING] | deep-link to maps [PROPOSED] |
| 19 | GPS | [PARTIAL] | live location fields/events; continuous stream transport [MISSING] |
| 20 | Arrival | [IMPLEMENTED] | status `arrived` in flow |
| 21 | Puja preparation | [PARTIAL] | status `in_progress`; checklist [MISSING] |
| 22 | Samagri checklist | [MISSING] | — |
| 23 | Service execution | [IMPLEMENTED] | status advance en_route→…→completed |
| 24 | Completion | [IMPLEMENTED] | `completed` frees availability |
| 25 | Cancellation | [IMPLEMENTED] | cancel path + reassign |
| 26 | Disputes | [PARTIAL] | tickets; structured disputes [MISSING] |
| 27 | Earnings | [IMPLEMENTED backend] | `earnings.tsx`, ledger partner_payable |
| 28 | Commission | [IMPLEMENTED] | platform_commission ledger entry |
| 29 | Ledger | [IMPLEMENTED] | `mp_ledger_entry` append-only |
| 30 | Payout requests | [PARTIAL] | payout processing exists (admin-initiated); self-request [MISSING] |
| 31 | Bank verification | [MISSING] | no bank-detail entity/penny-drop |
| 32 | Notifications | [PARTIAL] | in-DB; push transport [MISSING] |
| 33 | Reviews | [IMPLEMENTED] | rating aggregation on pandit |
| 34 | Support | [PARTIAL] | tickets backend; app entry [MISSING] |
| 35 | Account suspension | [IMPLEMENTED] | suspend gate enforced immediately |
| 36 | Security & device mgmt | [PARTIAL] | tokens; secure storage + device list [MISSING] |

## Screens & navigation (target)
- **Tabs:** Home (today/online toggle), Jobs (offers + active), Earnings, Profile.
- **Stack:** Onboarding/KYC wizard, Job detail (accept/reject, navigate, status
  stepper, samagri checklist, complete), Payout/bank, Support, Device & security.

## Cross-cutting (same rigor as 02)
- **Error states:** offer-expired (another pandit took it — 409), suspended (403),
  stale heartbeat (auto-offline), payout failure, KYC rejected.
- **Offline:** critical — a pandit loses signal mid-job. Must cache the active job,
  allow status updates to queue and reconcile, but never double-complete. **[PROPOSED]**
- **Background location:** foreground-service/background-location permissions + battery
  policy; only while on an active job. **[PROPOSED]**
- **Analytics:** go_online, offer_received, offer_accept/reject/expire, arrive,
  complete, payout_request.

## Key edge cases
- Two pandits accept same offer → atomic accept (row-lock, `SELECT … FOR UPDATE`) already
  prevents double-assign (concurrency tests, PG-only).
- Pandit goes offline with an active job → job stays assigned; ops escalation path.
- Payout while a refund is in-flight on the same booking → ledger must reconcile
  (append-only + settled flags exist).
