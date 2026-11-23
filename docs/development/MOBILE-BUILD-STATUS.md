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
