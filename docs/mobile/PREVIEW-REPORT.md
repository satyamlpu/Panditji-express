# Mobile Preview & Integration Verification Report

Follow-up to the merged redesign (PR #14, merge commit `349d988` on `main`).
Branch: **`feat/mobile-qa-polish`** (fixes on top of `main`). UI/UX only — no
backend logic, migrations, permissions, APK publishing or deploys were performed.

---

## 1. Repository state
- `main` synchronized; merge commit **`349d988`** verified present on `origin/main`,
  carrying all four redesign commits.
- Other worktrees preserved and untouched: main checkout (`feat/discovery-enrichment`),
  plus `release/full` (PR #11) and `chore/panditji-copy` in scratchpads. Only this
  worktree was used; the sole local untracked file (`.claude/launch.json`) is left as-is.
- **PR #12 compatibility:** touches only `app.json` / `eas.json` / `package.*` (no app
  `src/`). This branch leaves `app.json` IDs/plugins untouched and its dep versions match
  PR #12's → should merge cleanly.
- **PR #11 compatibility (integration BLOCKER):** PR #11 enriches `/discovery/pandits`
  with `eta_minutes`, `price_display`, `experience_years`, `specialisation` **and edits
  three files this redesign rewrote** — `customer-app/src/app/book/[slug].tsx`,
  `pandit-app/src/app/onboard.tsx`, `pandit-app/src/lib/model.ts`. Because `main` now has
  the rewritten versions, **PR #11 will hit merge conflicts in those files** and its
  feature intent must be re-applied onto the redesigned screens. Mitigation shipped here:
  the apps already ignore unknown fields and tolerate nulls, and the customer
  `PanditCard` now **surfaces `eta_minutes`** ("~X min away") when the backend provides
  it — so most of PR #11's discovery-display intent is already integrated.

## 2. Preview URLs (local)
| App | URL | Notes |
|-----|-----|-------|
| Customer | http://localhost:8091 | Expo web (metro) |
| Partner  | http://localhost:8092 | Expo web (metro) |
| Backend (preview) | http://localhost:8100 | 2nd uvicorn, **clean migrated+seeded** SQLite (`panditji-preview.db`), CORS for :8091/:8092 |

The shared backend on `:8099` and its DB were left untouched. The apps point at `:8100`
via `EXPO_PUBLIC_API_BASE`. Seeded logins (dev OTP auto-fills): customer `+919999900000`,
approved Panditji `+919000000001`.

**Expo QR / physical device:** these apps include `@sentry/react-native` and
`expo-secure-store`, which are not reliably available in Expo Go, so a scannable
Expo-Go QR is **not a dependable device path**. The supported device path is an **EAS
`preview` APK** (see §6). Web previews above are fully functional for review.

## 3. Visual quality audit
Audited every major screen in both apps (screenshots in
`docs/mobile/screenshots/preview/` and `docs/mobile/screenshots/`). Verified:
Apple-HIG structure, **vector icons everywhere (zero emoji)**, consistent type/spacing,
refined emerald/gold gradients, glassmorphism floating tab bars, real catalog
photography with designed placeholders, safe-area handling, no clipped text / overlap,
press-scale + skeleton animations, responsive mobile layout, **light + dark** appearance,
and Hindi/Devanagari rendering (ॐ mark, bilingual-ready copy).

**Dark mode** is now enabled (`app.json userInterfaceStyle: "automatic"`) and verified on
key screens. One dark-mode defect was found and fixed (see §5). Recommend a final
on-device dark spot-check of the long-tail screens before release.

## 4. Functional testing
Exercised against the live preview backend. **Working (verified end-to-end):**
- Auth (phone + OTP) — customer and partner.
- Discovery — services catalogue (real prices incl. "On request") and nearby-Panditji
  (real `distance_km`, `rating_avg`/"New", languages, and `eta_minutes` enrichment).
- **Full booking lifecycle (real data):** create → dispatch (`awaiting_acceptance`) →
  partner **accept** (`confirmed`) → en_route → arrived → in_progress → **completed** →
  customer **pay** (mock gateway) → **review**. Reflected on both sides: customer
  Bookings/Booking-detail (status, assigned Panditji, dispatch **history timeline**),
  partner Earnings (**₹1,500, 1 completed**).
- Navigation, profiles, addresses, support (read/create), partner onboarding/KYC screens.

**Blocked by backend environment (not a mobile defect):**
- On the **shared dev DB** (`:8099`/`panditji.db`), booking creation returns **HTTP 500 —
  `mp_booking has no column named preferred_pandit_id`**: the running backend code (from
  `feat/discovery-enrichment`) expects a column added by **PR #11's migration**, which has
  not been cleanly applied to that DB (its migration state is inconsistent). The mobile
  app sends the correct request; the error is server-side. Verification here used a
  freshly migrated + seeded copy to prove the flow works once the backend DB is correct.
- **Real payments / SMS OTP / push notifications** are dev stand-ins locally (mock pay,
  dev OTP code, no push) — these depend on production provider deployment, not the apps.

**Known pre-existing UX limitation (preserved, not a regression):** the customer
booking-detail tracks paid/reviewed in local state only, so a fresh load of an
already-paid/reviewed booking still shows "Pay now" and the review form (the backend
rejects duplicates). Fixing cleanly needs paid/reviewed flags on the booking response —
logged as a follow-up.

## 5. Fixes applied (this branch)
1. **Dark-mode gradient-button contrast** — gradient CTAs ("Find a Panditji", "Pay now",
   partner "Accept") used `onPrimary` text, which is dark in dark mode on the always-dark
   emerald gradient → illegible. Now forced to light text in both schemes.
2. **Status-bar contrast** — white-header secondary tab screens (customer Bookings/Alerts/
   Profile; partner My-pujas/Earnings/Profile) now set a dark status-bar style on focus
   (`useStatusBarStyle`), resetting to light elsewhere (emerald headers). Device-correct.
3. **`eta_minutes` surfaced** on `PanditCard` (honest, indicative, shown only when present)
   — forward-compatible with PR #11's discovery enrichment.
4. **Dark mode enabled** (`userInterfaceStyle: "automatic"`) — the token system already
   supported it.
5. **Brand re-theme to the real logo** — the apps were emerald-green, but the real Pandit
   Ji Express logo/website brand (v2.0) is **Kumkum Crimson `#9A1C24` + Agni Saffron +
   Swarna Gold on Parchment Ivory `#FBF5EA`** (maroon diya + gold flame). The whole design
   system (both apps, light + dark, every screen via tokens) is now re-themed: a crimson→
   maroon signature gradient for headers/hero/CTAs/splash, gold mark + ratings + ornaments,
   ivory surfaces; success stays green.
6. **Real logo everywhere the Om glyph was** — the in-app brand mark (splash + login,
   both apps) now renders the **actual Pandit Ji Express diya logo** (maroon lamp + ivory
   "प" + gold flame) as a `BrandLogo` react-native-svg component (vector paths from
   `frontend/public/logo-icon.svg`), framed by `BrandBadge`. The **launcher icon, splash
   image and favicon** assets (`icon.png`, `splash-icon.png`, `favicon.png`,
   `android-icon-foreground.png`) for both apps were regenerated from the logo (1024px
   maroon app-icon), so the installed app shows the real logo. _Minor polish for the store
   build:_ the Android adaptive config can later use a transparent diya foreground + maroon
   background color (needs the `app.json` android block from PR #12).

Checks after fixes: `npx tsc --noEmit` ✅, `npx expo lint` ✅ 0 problems, `npx expo-doctor`
✅ (version checks pass; the RN-Directory network check can fail transiently) — both apps.

## 6. Android build readiness
- The app code is **EAS-ready**: all added native modules (`expo-blur`,
  `expo-linear-gradient`, `expo-haptics`, `expo-image`, `react-native-svg`) are
  EAS-supported; `expo-doctor` passes; CNG (no hand-written `ios/`/`android/`).
- **Prerequisite:** `eas.json` and the Android `package` IDs
  (`com.panditjiexpress.customer` / `.partner`) + EAS `projectId` live in **PR #12**
  (unmerged). A fresh APK needs PR #12 merged first (or those values added).
- To avoid shipping an APK with the old UI, **bump `android.versionCode`** (PR #12 sets
  it to `1`) for the post-redesign build.
- Fresh internal APK (per app, after PR #12):
  ```bash
  cd customer-app && npx eas-cli@latest build --profile preview --platform android
  cd pandit-app   && npx eas-cli@latest build --profile preview --platform android
  ```
  The `preview` profile builds an internal-distribution APK pointing at
  `EXPO_PUBLIC_API_BASE=https://panditji-express2.vercel.app`.
- **Builds launched** (on approval) — EAS config (`eas.json` + app IDs/projectIds,
  matching PR #12) was added to this branch and the Android `preview` APK builds were
  queued under the `sbsharma3434` EAS account (remote-managed Android keystore):
  - Customer: build https://expo.dev/accounts/sbsharma3434/projects/customer-app/builds/d2454990-2568-4b74-9e29-961613a6c88f
    → **APK** https://expo.dev/artifacts/eas/U_3hKPv69g3BS1JqEmvqKAVx3yMw8ewsVODBP2ed7K0.apk
  - Partner:  build https://expo.dev/accounts/sbsharma3434/projects/pandit-app/builds/0a89fe39-fc25-44ff-a30b-4cedf602c6f1
    → **APK** https://expo.dev/artifacts/eas/aUR4eitkIHH7htHzBrUh1mJzdAEGT7NiEuAJpYN3VJ0.apk
  Both builds **FINISHED** successfully. Each is a fresh build of the redesigned
  (maroon/gold) UI with the real logo; the APKs point at the
  **production** backend (`EXPO_PUBLIC_API_BASE=https://panditji-express2.vercel.app`),
  so booking flows need that backend migrated to head (incl. `preferred_pandit_id`).
  **iOS builds kept paused** as requested.

## 7. Production deployment readiness
- **Mobile apps:** code-complete, typechecked, linted, doctor-clean, verified end-to-end on
  web. Ready for an internal EAS build once PR #12 lands.
- **Open items before production:**
  1. Merge **PR #12** (EAS config + app IDs) — required for any build.
  2. Resolve **PR #11** merge conflicts on the three redesigned files and re-apply its
     discovery/onboarding enrichment onto the new screens.
  3. Ensure the **production backend** is migrated to head (incl. `preferred_pandit_id`)
     so booking creation works — the local shared-DB 500 must not recur in prod.
  4. Wire real providers: payments gateway, SMS OTP, push notifications.
  5. Replace the Kanpur **preview coordinate** with real GPS/geocoding.
  6. Final on-device pass (light + dark) via the EAS preview APK.
- **Not done (needs explicit approval):** production migrations, permission/RLS changes,
  APK publishing, any deploy. iOS builds paused.
