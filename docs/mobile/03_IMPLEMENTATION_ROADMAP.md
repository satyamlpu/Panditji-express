# Mobile — Implementation Roadmap (PHASE 2–8)

Dependency-aware, **additive** (preserve the existing Expo apps + the shared `api.ts`
pattern). Each phase: scope, files, backend dependency, security, acceptance, gate.
**No building happens until approved.** "Done" means works **end-to-end**, not UI-only.

> Hard dependency: PART A/B flows become **functional in production** only after the
> backend lands **SMS/OTP + real payments + push** (tracked in the platform blueprint
> P4). Mobile work can proceed in parallel against **local/staging**, but store launch
> waits on those.

## PHASE 2 — Shared mobile foundation (PART C)
Build once, reuse in both apps (extract to a shared pattern; **never duplicate business
rules** — those stay on the backend).
- **API base config** — replace hardcoded localhost with env-driven base
  (`app.config.ts` + `EXPO_PUBLIC_API_BASE` per profile: dev/preview/prod). *(files:
  `src/lib/api.ts`, new `app.config.ts`)*
- **Secure token storage** — `expo-secure-store` (Keychain/Keystore) instead of
  AsyncStorage *(PART D)*.
- **Session handling + refresh** — if backend adds refresh for mobile (recommended) use
  it; else a clean re-auth UX on 401. Device/session registration.
- **Error / network-state / retry+backoff / idempotency** — typed errors (already
  have `ApiError`), offline detection (`@react-native-community/netinfo`), retry with
  backoff, `Idempotency-Key` on money POSTs (needs backend support).
- **Push notifications** (`expo-notifications`), **deep linking** (scheme already set:
  `panditji` / `panditjipartner`), **analytics + crash reporting** (Sentry RN).
- **Accessibility, localization (Hindi/English), theme/design tokens** (share brand
  tokens with web).
- **Gate:** shared foundation typechecks + lints (`npx expo lint`, `tsc --noEmit`);
  `expo-doctor` clean; native-module libs verified against **SDK 58** via `expo install`.

## PHASE 3 — Complete customer app (PART A)
Wire the **Backend-only** gaps + build **Not-implemented** screens:
- Wire: addresses, profile edit, booking events timeline, support tickets, pandit
  discovery/profiles, serviceability.
- Build: onboarding+language, search/filter, scheduled booking UX, price breakdown with
  add-ons/coupons (needs backend), reschedule (needs backend), invoices (needs backend),
  privacy + **account deletion** (needs backend), push, full loading/empty/error/offline
  states on every screen.
- **Payment:** integrate the real PSP SDK once backend P4 lands (keep mock for dev).
- **Gate:** each journey works end-to-end against staging; no UI-only screens remain.

## PHASE 4 — Complete partner app (PART B)
- Wire: notifications, support.
- Build: KYC document upload (needs backend endpoint + object storage), verification
  status UX, service expertise/languages/zones editors, availability calendar, maps
  navigation deep-link, puja checklist, earnings/commission/ledger views (earnings
  endpoint or ledger-derived), **payout request + bank verification** (needs backend),
  suspension/403 handling.
- **Background location** only during an active job (`expo-location` + task manager);
  battery + permission UX.
- **Gate:** partner lifecycle end-to-end against staging; financial views match ledger.

## PHASE 5 — Integrate real backend functionality
- Point apps at **staging**, exercise real OTP (SMS), real payment (PSP test mode), push
  delivery, realtime/poll tracking. Enforce **all** eligibility/financial rules on the
  backend (client never authoritative — PART D).
- **Gate:** no feature marked "Implemented" without an end-to-end pass on staging.

## PHASE 6 — Test Android & iOS (PART F)
- **Unit/integration** (jest + RN testing library), **E2E** (Maestro/Detox) for: auth,
  booking, payment failure+retry, duplicate submission, concurrency/assignment, GPS
  permissions, background location, push, offline, session expiry, unauthorized API
  access, crash recovery.
- **Real devices + emulators**, Android + iOS matrix.
- **Gate:** critical journeys green on both platforms; security/financial tests block release.

## PHASE 7 — Production builds (PART E)
- `app.json`: unique **iOS `bundleIdentifier`** + **Android `package`**, icons, splash,
  **permissions** (location/notifications/camera-for-KYC), version/build numbers.
- **EAS:** `eas.json` with dev/preview/production profiles; signing via EAS-managed
  credentials; **push credentials** (FCM key / APNs key).
- **Store metadata:** listings, screenshots, **privacy disclosures / data-safety**,
  **account-deletion URL/flow**.
- **No production secret** in repo or bundle (only `EXPO_PUBLIC_*` safe values; secrets
  stay server-side).
- **Gate:** `eas build` succeeds for both platforms; `expo-doctor` clean.

## PHASE 8 — Release-readiness review
- Verify PART D security checklist (SecureStore, no hardcoded secrets, safe deep links,
  location privacy, permission minimization, secure notification payloads, dependency
  scan).
- Verify PART G scale hygiene (pagination, image/CDN, backoff, no uncontrolled polling,
  analytics batching, feature flags, safe upgrade handling) — **capacity proven by
  backend/infra load tests, not assumed from Expo**.
- Account-deletion + data-export present (store + DPDP).
- **Gate:** sign-off; then — and only then, with explicit approval — build/submit.

## Sequencing & parallelism
```
PHASE 2 (foundation) ─┬─▶ PHASE 3 (customer) ─┐
                      └─▶ PHASE 4 (partner)  ─┴─▶ PHASE 5 (real integration) ─▶ 6 ─▶ 7 ─▶ 8
Backend P4 (SMS + payments + push) must land before PHASE 5 can truly pass / store launch.
```
PHASE 2 unblocks 3 & 4 (parallelizable). PHASE 5+ gated on backend integrations.

## Guardrails (from the assignment)
- Preserve existing architecture; extend, don't rewrite.
- `npx expo install` for every package (SDK-58 compatible); verify native-code libs need
  a dev build; never hand-edit `ios/`/`android/` (CNG).
- Do not claim a feature complete unless it works end-to-end.
- No deploy/publish/merge/production change without explicit approval.
