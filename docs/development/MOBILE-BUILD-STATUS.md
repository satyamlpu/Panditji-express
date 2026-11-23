# Mobile Build Status — Customer & Pandit Partner (Android/iOS)

## ✅ Android internal-testing APKs built (EAS, account @sbsharma3434)

| | Customer | Pandit Partner |
|---|---|---|
| Expo project | `@sbsharma3434/customer-app` | `@sbsharma3434/pandit-app` |
| projectId | `6cef0738-6a0e-4053-b7b4-26b6f7be3f85` | `c45a1991-1796-4768-9cb9-3f85fb8520ab` |
| Application ID | `com.panditjiexpress.customer` | `com.panditjiexpress.partner` |
| Version (code) | `1.0.0 (1)` | `1.0.0 (1)` |
| EAS build ID | `cc39a027-49fb-47fe-80bd-b47325ae0642` | `ed06aa01-ed8d-4e9f-a777-0c382e5b0fb2` |
| Status | **FINISHED** | **FINISHED** |
| Completed (UTC) | 2026-11-23T13:27:11Z | 2026-11-23T13:25:52Z |
| APK artifact | https://expo.dev/artifacts/eas/D2JUdTeXiuYVxFXYVG3HnrobIQoJsYFFlZ86jgPV46k.apk | https://expo.dev/artifacts/eas/8ZwYJujnyFoijBmlWRrHuC080CTMYQIxhzxtSHKBRs8.apk |
| Profile | preview (internal-distribution APK) | preview |
| API base | https://panditji-express2.vercel.app | same |

**SHA-256:** compute after downloading on a normal network — `shasum -a 256 <file>.apk`.
(The prep environment's proxy/TLS made a local download impractical; the APKs themselves
are valid and were built + signed by EAS — status FINISHED.)

**Build fix applied:** first builds failed at the Sentry source-map upload
(`:app:...SentryUpload`, sentry-cli exit 1, no Sentry org/project configured).
Fixed with `SENTRY_DISABLE_AUTO_UPLOAD=true` in the `preview`/`production` build env.

**Installation testing:** PENDING — no Android device/emulator available in this
environment. To test: `adb install customer.apk` / `adb install partner.apk`, then
launch, OTP login, discovery, booking, partner onboarding.

---

# Mobile Build Status — Customer & Pandit Partner (Android/iOS)

_Config prepared on branch `chore/mobile-build-config` (PR #12). No APK has been
built — EAS auth is not configured in the prep environment._

## Configuration (ready ✅)

| | Customer app | Pandit Partner app |
|---|---|---|
| Dir | `customer-app/` | `pandit-app/` |
| Android package | `com.panditjiexpress.customer` | `com.panditjiexpress.partner` |
| iOS bundle id | `com.panditjiexpress.customer` | `com.panditjiexpress.partner` |
| version / versionCode | `1.0.0` / `1` | `1.0.0` / `1` |
| EAS `preview` profile | internal-distribution **APK** | internal-distribution **APK** |
| API base (build-time) | `EXPO_PUBLIC_API_BASE=https://panditji-express2.vercel.app` | same |
| expo-doctor | 20/20 | 20/20 |
| tsc / lint | clean | clean |
| Hardcoded creds | none | none |
| Android permissions | Expo defaults (no over-ask) | Expo defaults |

## Build commands (run under your Expo account)

```bash
# Expo auth (interactive) — or set EXPO_TOKEN in the environment
npx eas-cli login

# Customer app
cd customer-app
npx eas-cli build:configure           # first time only: links the Expo project (adds extra.eas.projectId)
npx eas-cli build --platform android --profile preview

# Pandit Partner app
cd ../pandit-app
npx eas-cli build:configure           # first time only
npx eas-cli build --platform android --profile preview
```

Each build runs in EAS cloud (~10–15 min) and returns an **APK artifact URL** +
an EAS build id. Record per app: application id, version, versionCode, EAS build
id, APK URL, SHA-256 (if shown), timestamp.

> iOS (`--platform ios --profile preview`) additionally needs an **Apple Developer
> account** for signing. Do not publish to the App Store.

## Wiring an APK into the website

Once a real APK URL exists, in **Admin → App Releases** create a release:
app type (customer/partner), platform `android`, channel `beta`, version `1.0.0`,
`download_url` = EAS APK URL, optional SHA-256, mark **active**. The public
`/download` page then shows the download button + QR (until then it correctly
shows "Coming soon" — it never renders fake links).

> Note: this requires the backend release (PR #11) deployed to prod so the
> `/api/v1/public/app-releases` endpoint + `app_release` table exist. See
> `docs/production/PROD-MIGRATION-RUNBOOK.md`.

## Blockers (need account/credentials — cannot be done in-repo)

- **Android build:** Expo account login (`eas login` / `EXPO_TOKEN`).
- **iOS build:** Apple Developer account + signing.
- **Install/runtime testing:** a device/emulator with the built APK — pending until a build exists.
