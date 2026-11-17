# 26 — Architecture Decision Records

Lightweight ADRs for the decisions this blueprint takes or recommends. Status:
**Accepted** (reflects current code), **Proposed** (recommended), **Open** (needs a call).

---
## ADR-001 — Keep a modular monolith; defer microservices
**Status:** Accepted. **Context:** single FastAPI app serves web, both apps, admin.
**Decision:** extend the modular monolith; extract a service only on measured evidence
of a specific bottleneck (rule #14). **Consequences:** simpler ops/transactions now;
revisit for dispatch/tracking/notifications at S2/S3 (17).

---
## ADR-002 — One versioned API for all clients
**Status:** Accepted. **Decision:** web, customer app, partner app, admin all use
`/api/v1` with the same auth + contracts; no separate CMS backend. **Consequences:**
consistent authz/audit; need disciplined versioning + contract tests (08/19).

---
## ADR-003 — Append-only ledger as the money source of truth
**Status:** Accepted. **Decision:** all money movements are `mp_ledger_entry` rows;
balances derived; refunds/payouts post entries, never mutate. **Consequences:**
auditable, reconcilable; requires reconciliation + idempotency (13).

---
## ADR-004 — Deny-by-default RBAC now, ABAC overlays next
**Status:** Accepted (RBAC) / Proposed (ABAC). **Decision:** role-scoped, DB-resolved
authz today; add permission registry + ABAC (object/amount/geo/team, maker-checker,
MFA, break-glass) in P1. **Consequences:** stronger least-privilege; more policy code +
negative tests (10/22).

---
## ADR-005 — Outbox pattern for all external effects
**Status:** Proposed. **Decision:** SMS, push, email, payment callbacks, scheduled
dispatch go through a transactional **outbox** + durable worker (at-least-once +
idempotent). **Consequences:** needs a queue + worker runtime (serverless can't host
durable workers) → ADR-007.

---
## ADR-006 — Idempotency keys on all money-mutating POSTs
**Status:** Proposed. **Decision:** `Idempotency-Key` + `idempotency_key` dedup table
for booking-create, pay, refund, payout. **Consequences:** safe client retries; small
storage + middleware.

---
## ADR-007 — Add a long-lived worker runtime + Redis + queue
**Status:** Proposed / Open (platform choice). **Context:** Vercel serverless has no
durable background workers, execution caps, cold starts. **Decision:** introduce Redis
(rate-limit/cache/locks/presence) and a queue + worker (container on Fly/Render/Cloud
Run, or managed QStash/SQS). **Consequences:** unblocks scheduled dispatch, outbox,
retries, GPS batching; adds ops surface. **Open:** which platform.

---
## ADR-008 — Object storage + short-lived signed URLs for KYC/media
**Status:** Proposed. **Decision:** store KYC docs + CMS media in object storage (S3/GCS/
Supabase Storage); serve via signed URLs with access logging. **Consequences:** private
sensitive docs; replaces placeholder media; CDN for public media.

---
## ADR-009 — Realtime via Supabase Realtime first
**Status:** Proposed / Open. **Decision:** prefer Supabase Realtime (already on Supabase)
for live tracking before building a bespoke WS service; throttle GPS, Redis for
last-known, partitioned durable store. **Consequences:** lowest new infra; validate
scale; fall back to WS/SSE if needed (14).

---
## ADR-010 — Payments via a server-verified PSP; mock is dev-only
**Status:** Proposed / Open (provider). **Decision:** replace the mock with a real PSP
(Razorpay/PhonePe/Cashfree/…): server-created order, client SDK, **server-verified**
signed webhook, idempotency, reconciliation. **Consequences:** real money flow; provider
selection + compliance (13). **Open:** provider choice.

---
## ADR-011 — SMS/OTP via a DLT-registered provider
**Status:** Proposed / Blocked. **Decision:** integrate a DLT-registered SMS provider
(MSG91/Gupshup/Kaleyra/Twilio) for OTP + transactional templates; keep OTP hardening.
**Consequences:** unblocks real mobile auth. **Blocked on:** DLT registration + provider
account (business action).

---
## ADR-012 — Mobile: Expo + expo-router, secure storage, config-driven API
**Status:** Proposed (current apps are skeletons). **Decision:** productionize the two
Expo apps — move secrets/tokens to Keychain/Keystore (`expo-secure-store`), config the
API base per environment (not hardcoded localhost), add push, offline rules, store
compliance. **Consequences:** shippable apps; CI/build pipeline for store releases.

---
## ADR-013 — Forward-only, additive migrations with backup preconditions
**Status:** Accepted. **Decision:** Alembic forward-only; prefer additive + feature flags;
destructive changes require a verified backup + staging run; `CREATE INDEX CONCURRENTLY`
for large tables. **Consequences:** safe evolution; no destructive prod migration without
DR cover (20).

---
## ADR-014 — Release gates block on security/financial/data-integrity failures
**Status:** Proposed. **Decision:** a green build is never sufficient; authz regressions,
money-integrity failures, failed backup-restore, and red core E2E **block** release
(19). **Consequences:** slower but safer releases for a money platform.

---
## Open decisions needing a human/business call
- Worker/queue platform (ADR-007), PSP (ADR-010), SMS provider (ADR-011).
- Realtime transport confirmation (ADR-009).
- Cancellation-fee + commission-config policy (business).
- Data retention windows + DPDP obligations (legal).
- UP rollout sequencing + scale targets to load-test against.
