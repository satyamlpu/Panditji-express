# Monitoring Review (Sentry)

**Backend:** `app/core/observability.py`, wired in `app/main.py:38`.
**Frontend:** `sentry.server.config.ts`, `sentry.edge.config.ts`,
`src/instrumentation.ts`, `src/instrumentation-client.ts`, `next.config.ts`.

## Backend (verified)

`init_observability()` (`observability.py:22`) returns immediately unless
`SENTRY_DSN` is set; otherwise `sentry_sdk.init(dsn, environment=app_env,
traces_sample_rate=settings.sentry_traces_sample_rate, send_default_pii=False)`,
all wrapped in `try/except` that only logs on failure (`:36`).

- **Missing DSN handled safely:** yes — no-op, no network, dependency optional at
  runtime (dev/CI never reach out). Verified.
- **PII:** `send_default_pii=False` (`:33`) — Sentry will not attach request
  bodies, headers, cookies or user IP by default. Verified.
- **Init failure safe:** wrapped; a bad DSN logs a warning, does not crash
  startup. Verified.
- **Env separation:** `environment=settings.app_env` (`development` / `production`).

## Frontend (verified)

- Server (`sentry.server.config.ts`) and edge (`sentry.edge.config.ts`): init
  gated on `SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN`; `sendDefaultPii:false`,
  `tracesSampleRate:0`.
- Client (`instrumentation-client.ts`): gated on `NEXT_PUBLIC_SENTRY_DSN`;
  `sendDefaultPii:false`.
- `instrumentation.ts` `register()` imports the server/edge config per
  `NEXT_RUNTIME`, and re-exports `captureRequestError as onRequestError`.
- `next.config.ts` wraps with `withSentryConfig(..., { silent: !CI,
  disableLogger: true })`. Source-map *upload* is skipped unless
  `SENTRY_ORG/PROJECT/AUTH_TOKEN` are set, so unconfigured builds work.

## Findings

### M‑1 — production event delivery is NOT verified, only configured (INFO → condition)
No DSN is set in this environment, so **no event has ever been delivered** to a
Sentry project. The wiring is correct by inspection, but "errors are actually
captured in prod" is unproven. 
- **Recommendation:** after setting the DSNs, trigger one deliberate test error
  on backend and frontend and confirm it lands in the Sentry project + the right
  `environment`. Until then, treat monitoring as *configured, not live*.

### M‑2 — no `beforeSend` scrubbing beyond the PII default (LOW)
`send_default_pii=False` excludes the obvious PII, but it does **not** scrub
values embedded in exception messages, breadcrumbs, or custom context — e.g. a
phone number or OTP interpolated into an error string, or an `Authorization`
header added via custom instrumentation later.
- **Recommendation:** add a `before_send` (backend) / `beforeSend` (frontend)
  hook that drops `Authorization`/`Cookie` and redacts known PII fields (phone,
  OTP, payment refs) as defence-in-depth. This matters for a money system.

### M‑3 — source maps generated and (by default) served to users (LOW)
The build log shows Sentry enabling source-map generation; the SDK itself warns
that without `sourcemaps.deleteSourcemapsAfterUpload: true` the maps may be
served publicly (source disclosure).
- **Recommendation:** set `sourcemaps.deleteSourcemapsAfterUpload: true` (or
  `sourcemaps.disable`) in `withSentryConfig` once upload is configured.

### M‑4 — no `global-error.js` (LOW)
Build warns that React render errors in the App Router aren't reported without a
`global-error.tsx` with Sentry instrumentation. Client-side render crashes will
be missed.
- **Recommendation:** add `src/app/global-error.tsx` per Sentry's Next.js guide.

### M‑5 — tracing effectively off (INFO)
`traces_sample_rate` defaults to `0.0` (backend) and `tracesSampleRate:0`
(frontend) — error capture only, no performance tracing. Fine for P0; note it so
no one assumes APM data exists.

## Area status: **PASS WITH CONDITIONS / NOT VERIFIED (delivery)**
Wiring is correct, safe when unconfigured, and PII-conservative. But end-to-end
delivery is unverified (M‑1), and scrubbing (M‑2), source-map hygiene (M‑3) and
the global error handler (M‑4) should be added before this is considered a
complete production monitoring setup.
