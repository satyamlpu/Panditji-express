# 18 — Performance & SLOs

> No performance baseline has been measured yet. The SLOs below are **proposed targets**
> to be validated by load/perf tests; current numbers are unknown **[NEEDS-VALIDATION]**.

## Service Level Indicators (SLIs)
| SLI | Where measured |
|---|---|
| API availability (non-5xx / total) | API edge + per-endpoint |
| Latency p50/p95/p99 | per critical endpoint |
| Error rate | per endpoint, per principal type |
| DB pool saturation / query time | DB/driver |
| Dispatch fill rate + time-to-match | dispatch module |
| Payment success rate + webhook latency | payments |
| Notification delivery latency | outbox worker |
| Web Core Web Vitals (LCP/INP/CLS) | website RUM |

## Proposed SLOs (targets)
| Journey / endpoint | Target |
|---|---|
| Public content GET (cached) | p95 < 200 ms (edge), high availability |
| Auth (login/OTP verify) | p95 < 400 ms |
| Booking create | p95 < 600 ms |
| Pay / webhook processing | p95 < 800 ms; 100% idempotent |
| Dispatch offer issue | p95 < 500 ms; time-to-match target (business-set) |
| Tracking read | p95 < 300 ms (poll) / < 2 s freshness (realtime) |
| API availability | 99.9% target (to be proven) |
| Web LCP (home) | < 2.5 s on 4G mobile |

## Performance budgets
- **Web:** homepage already SSG/ISR + CDN. Budget: JS < ~200 KB first load target,
  images optimized (WebP/AVIF once media→object storage), no layout shift.
- **API:** no N+1 in hot paths (dispatch candidate query, booking/payment lists);
  paginate large lists; index-backed filters only.
- **Mobile:** cold start, list scroll 60fps, image caching, minimal re-renders.

## Load/stress/soak/spike (test types — see 19)
| Test | Goal |
|---|---|
| Load | sustained expected peak; confirm SLOs |
| Stress | find breaking point; confirm graceful degradation |
| Spike | OTP/booking surge (festival days) — the realistic risk for this business |
| Soak | memory/connection leaks over hours |
| Resilience | Redis/queue/DB-replica failure → fail-open/degrade correctly |

**Festival spikes** are the signature load pattern (pujas cluster around auspicious
dates) — model and test for sharp, predictable surges, not just steady growth.

## Current known performance characteristics (qualitative)
- Serverless cold starts add latency on idle (observed on `/health`); keep-warm or move
  hot/background to a long-lived runtime at S1.
- Dispatch candidate query is the hottest business query — must stay indexed; cache
  presence in Redis at S1.
- Append-only ledger/events/tracking are write-heavy — partition at S2.

## Acceptance criteria
- SLOs defined per endpoint and dashboarded before scale claims.
- Load test evidence attached before asserting any throughput/user-count capability.
- Regression budget: a release that worsens a critical p95 beyond budget is a release
  gate failure.
