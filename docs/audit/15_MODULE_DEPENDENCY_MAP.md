# 15 — Module Dependency Map

Dependency order for safe, incremental delivery. An arrow A → B means **A depends on B** (B must exist/stabilize first).

```mermaid
graph TD
  INFRA["Infra: Postgres+PostGIS · Redis · Queue · Object storage · Observability · CI/CD"]
  IDN["Identity & RBAC"]
  CMS["Website CMS"]
  CRMc["Customer CRM"]
  CRMp["Pandit CRM + Verification"]
  CAT["Service catalogue + Pricing/Commission"]
  SRV["Serviceability (geo)"]
  BOOK["Booking engine"]
  SCHED["Scheduling engine"]
  DISP["Dispatch & assignment"]
  GPS["GPS & realtime"]
  PAY["Payment & financial ledger"]
  NOTE["Notifications"]
  SUP["Support & reviews"]
  ANA["Analytics"]
  GOV["Audit & governance"]

  IDN --> INFRA
  CMS --> IDN
  CRMc --> IDN
  CRMp --> IDN
  CAT --> IDN
  SRV --> CAT
  SRV --> INFRA
  BOOK --> CRMc
  BOOK --> CAT
  BOOK --> SRV
  SCHED --> BOOK
  SCHED --> INFRA
  DISP --> BOOK
  DISP --> CRMp
  DISP --> SCHED
  DISP --> INFRA
  GPS --> DISP
  GPS --> INFRA
  PAY --> BOOK
  PAY --> INFRA
  NOTE --> BOOK
  NOTE --> INFRA
  SUP --> BOOK
  ANA --> BOOK
  ANA --> PAY
  GOV --> IDN
```

## Critical-path chain
`Infra → Identity/RBAC → {Catalogue, CRM} → Serviceability → Booking → {Scheduling, Dispatch} → {GPS, Payment} → {Notifications, Support, Analytics} → Governance.`

## Key coupling notes
- **Infra is the universal prerequisite** for the scale/correctness work: Postgres unblocks atomic locking; Redis+Queue unblock Scheduling, real expiry, Notifications, and realtime GPS.
- **Dispatch depends on Scheduling** to make scheduled bookings real (today Dispatch exists but Scheduling doesn't, which is why scheduled bookings are dead).
- **Payment depends on Booking state** and must be coupled to it (cancellation→refund) — fix the invariant when touching either.
- **Analytics depends on Booking + Payment** data shapes — build last to avoid rework.
- **Most modules already exist**; the map is primarily a *hardening/completion* order, not a greenfield build order.
