# Free Mobile Testing Environment

A complete, **free** way to test both apps (customer + partner) end-to-end —
real backend auth, JWT, DB persistence, roles, sessions — **without buying any
SMS credits**. Authentication uses a configurable **mock OTP provider**: a fixed
test code, no SMS, restricted to allowlisted numbers. Production is untouched and
keeps real SMS.

> This does **not** bypass the login screen. Testers log in through the normal
> phone + OTP flow; only the OTP *delivery* is mocked. Every other part of auth
> (code expiry, single-use, verify-attempt limits, rate limiting, JWT issue,
> auto-registration, role-based access) runs exactly as in production.

---

## 1. How it works

| Environment   | `APP_ENV`     | OTP provider | SMS sent | Who can log in |
|---------------|---------------|--------------|----------|----------------|
| Development   | `development` | mock         | no       | anyone (local) |
| **Staging**   | `staging`     | **mock**     | **no**   | **allowlisted test numbers only** |
| Production    | `production`  | real (MSG91) | yes      | any real number |

**Backend** (`OTP_MODE`, see `backend/.env.example`):
- `mock` — issues the fixed `OTP_TEST_CODE` (default `123456`), sends no SMS, and
  (when `OTP_TEST_NUMBERS` is set) only allowlisted numbers may request a code.
  The code is returned in the API response so testing needs no SMS gateway.
- `sms` — a random code is sent via MSG91 and **never** returned. If the provider
  is unavailable it **fails closed** (HTTP 503) rather than silently not sending.
- Unset → auto: `sms` in production, `mock` everywhere else.

**Safety guards** (enforced at boot by `settings.validate_runtime()`):
- Production **refuses to start** with the mock provider enabled → the test code
  can never authenticate a real production account.
- Production warns if SMS is not configured.
- Staging is a separate deploy with an **isolated test database**, so test
  accounts never touch production data.

---

## 2. Deploy the staging backend (one-time, free)

The testing APKs point at `https://panditji-backend-staging.onrender.com`. Bring
it up with the committed Render blueprint (free plan) — it is **one-click**:

1. Render → **New → Blueprint** → connect this repo, then set:
   - **Branch** → the branch with the testing config (`feat/mock-otp-testing-env`,
     or `main` once the testing PR is merged).
   - **Blueprint Path** → **`render.staging.yaml`** (the staging-only blueprint).
     > The default `render.yaml` is **production** — it would ask for a prod DB.
     > Use `render.staging.yaml` so only the testing backend + its free test
     > database are created.
2. The blueprint prompts for the one var it can't guess:
   - `OTP_TEST_NUMBERS` — comma-separated E.164 allowlist of the number(s) you
     will test with, e.g. `+919000000001,+919000000002`.
   Everything else is automatic: `APP_ENV=staging`, `OTP_MODE=mock`,
   `OTP_TEST_CODE=123456`, `DATABASE_URL` (from the test DB), and generated
   `JWT_SECRET` / `PAYMENT_WEBHOOK_SECRET`.
3. **Apply / Deploy.** Migrations run automatically on start
   (`alembic upgrade head` in the start command), so the tables always exist —
   nothing to run by hand.
4. Wait for "Live", then confirm:
   ```bash
   curl https://panditji-backend-staging.onrender.com/health
   ```
   A free service sleeps when idle, so the **first** request after a while takes
   ~30–60s to wake — the app may show "Request Failed" if it times out; just
   retry once it's awake.

> Prefer Vercel? Deploy a separate staging project instead and point both
> `eas.json` → `testing` profiles' `EXPO_PUBLIC_API_BASE` at its URL (Vercel is
> serverless, so set `DATABASE_URL` to a hosted Postgres and run migrations
> separately).

---

## 3. Build the testing APKs

Separate **`testing`** EAS profile in each app (`customer-app/eas.json`,
`pandit-app/eas.json`): internal distribution, APK, staging env. The dynamic
`app.config.js` gives testing builds **distinct identifiers** so they install
side-by-side with — and can never be confused with — production:

| App      | Production id                   | Testing id                              | Testing name                  |
|----------|---------------------------------|-----------------------------------------|-------------------------------|
| Customer | `com.panditjiexpress.customer`  | `com.panditjiexpress.customer.staging`  | **Pandit Ji Express (Testing)** |
| Partner  | `com.panditjiexpress.partner`   | `com.panditjiexpress.partner.staging`   | **Pandit Ji Partner (Testing)** |

Every testing build also shows an always-on **⚠ TESTING ENVIRONMENT** strip at
the top of the screen (with the backend host), so a tester can never mistake it
for the live app.

Build (from each app directory):

```bash
npx eas-cli@latest build --platform android --profile testing
```

```bash
cd pandit-app && npx eas-cli@latest build --platform android --profile testing
```

Each finishes with an **APK download link** on the EAS build page
(`https://expo.dev/accounts/sbsharma3434/projects/<app>/builds`).

### Build versions (built 2026-11-27)
App version `1.0.0`, Android `versionCode 1`, profile `testing`, internal APK.

**Customer — Pandit Ji Express (Testing)** · `com.panditjiexpress.customer.staging`
- APK: https://expo.dev/artifacts/eas/ipSx3zPbCe5mH8fym-RNYLktXslDcuze0J1Z8YonS1U.apk
- Build: https://expo.dev/accounts/sbsharma3434/projects/customer-app/builds/f5b79bf8-26ef-45de-bbd0-216b44a2a7f6

**Partner — Pandit Ji Partner (Testing)** · `com.panditjiexpress.partner.staging`
- APK: https://expo.dev/artifacts/eas/6zRgui-8T6EWJd9w48LJzmKbl9icL-t5mCZ3v0f4Ep0.apk
- Build: https://expo.dev/accounts/sbsharma3434/projects/pandit-app/builds/46ff4425-07f7-4581-a05c-ec2ebc7d783f

> These APKs point at `https://panditji-backend-staging.onrender.com`. They
> install side-by-side with production and show the **⚠ TESTING ENVIRONMENT**
> strip. Login works once the staging backend (§2) is deployed with the mock
> OTP provider and the test numbers allowlisted.

---

## 4. Authorized test login instructions

1. Install the **(Testing)** APK on the device (allow "install from unknown
   sources" for the installer).
2. Open the app — confirm the orange **⚠ TESTING ENVIRONMENT** strip is visible.
3. On the login screen enter an **allowlisted** number (one of the numbers you
   put in `OTP_TEST_NUMBERS`), in the app's normal format.
4. Request OTP → enter the test code **`123456`** → continue.
   - A number **not** on the allowlist is rejected ("not an authorized test
     number") — this is expected.
5. First login auto-registers the account (customer, or partner in KYC-draft);
   subsequent logins reuse it. Roles and sessions behave as in production.

---

## 5. Physical-device testing checklist

**Setup**
- [ ] Staging backend `/health` returns OK; `EXPO_PUBLIC_API_BASE` matches it.
- [ ] Testing APK installed; **⚠ TESTING ENVIRONMENT** strip visible on launch.
- [ ] App installs alongside (not over) any production build — distinct icon/name.

**Auth (customer + partner)**
- [ ] Allowlisted number + `123456` logs in; JWT session persists across restart.
- [ ] Non-allowlisted number is refused at OTP request.
- [ ] Wrong code is rejected; code expires after 5 min; re-request (resend) works.
- [ ] Rapid repeated OTP requests hit the rate limit.
- [ ] Customer first login creates a customer; partner first login starts KYC.
- [ ] Role separation: partner-only screens unavailable to a customer token.

**Core flows**
- [ ] Customer: browse → book → view booking; addresses; support ticket.
- [ ] Partner: onboarding/verification; job list → active job; notifications.
- [ ] Offline banner appears with network off; recovers when back online.
- [ ] No "Request Failed" errors; backend requests hit the staging host.

**Data isolation**
- [ ] Test accounts appear only in the staging DB, never in production.

---

## 6. Guardrails (do not change without approval)
- The mock provider is **refused in production** — never set `OTP_MODE=mock` on
  the production service.
- Keep the staging `DATABASE_URL` isolated from production.
- Production SMS (MSG91) and real auth are unchanged by this environment.
