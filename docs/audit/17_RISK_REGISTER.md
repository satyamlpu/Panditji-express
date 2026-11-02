# 17 — Risk Register

Likelihood (L) / Impact (I): H/M/L. Priority = L×I weighted by money/data criticality. Each risk cross-references its detailed section.

| ID | Risk | L | I | Pri | Evidence | Mitigation | Phase |
|---|---|---|---|---|---|---|---|
| RK-01 | **Payment webhook forgery** if prod runs with default `payment_webhook_secret` (validate_runtime checks only JWT). | M | H | **Critical** | `08` S1, `config.py:93-99,64` | Reject default webhook/revalidate secrets in prod; secret store. | P1 |
| RK-02 | **Double-assignment** of a booking (unlocked accept, no unique invariant). | M | H | **Critical** | `05` R1 / `08` S4 (`dispatch.py:261-334`) | Row lock + unique accepted-attempt index + concurrency test. | P1 |
| RK-03 | **Financial double-credit / over-refund / double-payout** under concurrent webhooks/refunds/payouts. | M | H | **Critical** | `07` / `05` R2,R3 (`finance.py`) | Lock payment row; unique ledger-per-event; serialize payouts. | P1 |
| RK-04 | **Scheduled bookings never run** (no scheduler) — silent business failure. | H | H | **Critical** | `05` R4 (`customer.py:223-225`) | Scheduler + queue. | P4 |
| RK-05 | **No backups / DR** for a money system. | M | H | **Critical** | `12` | Automated PG backups + tested restore. | P3 |
| RK-06 | **SQLite / single-instance** can't scale; logic relies on its write lock. | H | H | **High** | `09`, `04` | Postgres + Redis + stateless instances. | P2–P4 |
| RK-07 | **No CI/CD / no monitoring** — regressions & failures invisible. | H | M | **High** | `12` | CI pipeline + Sentry/metrics/alerts. | P3 |
| RK-08 | **Status columns uncheck-constrained**; invalid states persist. | M | M | High | `04` D2 | DB CHECK/enum. | P2 |
| RK-09 | **Ledger FK gaps** (`payout_id` no FK; SET NULL) weaken financial integrity. | L | H | High | `04` C | Add FK; RESTRICT. | P2 |
| RK-10 | **Payment/booking state divergence** (cancel doesn't refund). | M | M | High | `05` R6 | Couple states; reconciliation job. | P4/P9 |
| RK-11 | **Stored XSS** via weak sanitizer + JSON-LD injection. | L | M | Medium | `08` S2,S3 | DOMPurify + escape JSON-LD. | P7 |
| RK-12 | **No booking idempotency** — retries create duplicate bookings. | M | M | Medium | `05` R5 | Idempotency key + unique. | P4 |
| RK-13 | **Lazy offer expiry** — bookings stall without a reader. | M | M | Medium | `05` R7 | Scheduler timers. | P4 |
| RK-14 | **O(n) geo matching** on unindexed floats. | M | M | Medium | `09`, `04` | PostGIS + GiST. | P2 |
| RK-15 | **Local-disk media, no CDN** — not multi-instance, no edge. | M | M | Medium | `09`, `12` | Object storage + CDN. | P7 |
| RK-16 | **Notifications not delivered** (records only). | H | M | Medium | `13` | Delivery via queue + provider. | P6 |
| RK-17 | **Suspended pandit retains API access.** | L | M | Medium | `08` S5 | Status gate in principal. | P1 |
| RK-18 | **Rate limiter in-memory + ignores XFF** — bypass/ineffective at scale. | M | M | Medium | `08` S8 | Redis limiter + trusted XFF. | P1/P4 |
| RK-19 | **No concurrency/frontend/e2e/load tests.** | H | M | Medium | `11` | Add the test matrix + load tests. | P1,P10 |
| RK-20 | **Default seed-admin password** (`Admin!Pandit123`) if not overridden. | L | H | Medium | `08`, `config.py:59` | Force change on deploy. | P3 |
| RK-21 | **OTP unsalted SHA-256**; **upload trusts content-type**; **debug defaults True**. | L | M | Low | `08` S6,S7,S9 | Keyed hash; sniff bytes; force debug off. | P1/P7 |
| RK-22 | **GPS location not purged on tracking end**; no retention policy. | L | M | Low | `06` | Purge on terminal; retention policy. | P8 |
| RK-23 | **psycopg not installed** — documented PG deploy fails at import. | M | M | Low | `01`, `04` | Enable psycopg. | P2 |
| RK-24 | **No admin-user/role management UI**; RBAC gating not exhaustive. | M | M | Low | `03`, `13` | Governance workspace + role gating. | P9 |

## Top-5 to fix immediately (Milestone 1)
RK-01 (secret), RK-02 (double-assign), RK-03 (financial double-post), RK-05 (backups), RK-07 (CI) — the first three are cheap code+constraint changes with the highest money/data impact.
