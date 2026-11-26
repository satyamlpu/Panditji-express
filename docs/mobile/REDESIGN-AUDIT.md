# Mobile Redesign — Phase 0 Audit

_Branch: `feat/premium-mobile-ui-ux` · Scope: `customer-app/` + `pandit-app/` (Expo SDK 58, expo-router, RN 0.88, TS)_

This is the pre-work audit for the premium UI/UX redesign of both Expo apps. It
records what exists today, what is reusable, every inconsistency the redesign
must fix, the **real** backend data available (so no screen fabricates data), and
how the work stays clear of the in-flight PRs (#11, #12).

---

## 1. App structure (today)

Both apps are expo-router projects with an identical skeleton:

```
src/
  app/                 expo-router routes (each file = a screen)
    _layout.tsx        root Stack + providers (Sentry, I18n, Auth, SafeArea, OfflineBanner)
    index.tsx          splash → redirect by auth
    login.tsx          phone + OTP
    (tabs)/_layout.tsx bottom tab navigator (emoji icons)
  components/
    ui.tsx             per-app component kit (DIVERGED between apps)
    OfflineBanner.tsx
  lib/
    api.ts             fetch client (timeout, retry, 401 handling) → FastAPI only
    auth.tsx           token context (SecureStore / AsyncStorage)
    i18n.tsx           hi/en scaffold (Hindi default)
    net.ts             NetInfo online hook
    storage.ts         secure token storage
    observability.ts   Sentry init
  theme.ts             color/space/radius/shadow tokens (DIVERGED between apps)
```

### Customer app routes
`index` (splash) · `login` · `(tabs)/index` (home) · `(tabs)/bookings` ·
`(tabs)/notifications` · `(tabs)/profile` · `book/[slug]` (checkout) ·
`booking/[id]` (tracking/pay/review) · `addresses` · `support` · `ticket/[id]`.

### Pandit (partner) app routes
`index` (splash) · `login` · `onboard` · `(tabs)/index` (dashboard) ·
`(tabs)/jobs` · `(tabs)/earnings` · `(tabs)/profile` · `job/[id]` (lifecycle +
live-location) · `verification` (KYC upload) · `notifications` · `support` ·
`ticket/[id]`.

Partner tab structure (**Home · My pujas · Earnings · Profile**) must be
preserved per the brief; customer tabs become **Home · Bookings · Alerts · Profile**.

---

## 2. Reusable pieces (keep the logic, restyle the surface)

These are sound and must be preserved exactly as behaviour:

- **`lib/api.ts`** — timeout, GET-only retry/backoff, 401→logout, `postForm`
  (pandit). All screens talk ONLY to the FastAPI backend via `EXPO_PUBLIC_API_BASE`.
- **`lib/auth.tsx`, `lib/storage.ts`** — token lifecycle, secure storage, migration.
- **`lib/i18n.tsx`** — hi/en dictionary + `useI18n()` (currently under-used; the
  redesign should route visible copy through it where practical).
- **`lib/net.ts` + `OfflineBanner`** — connectivity UX.
- **`pandit-app/src/lib/model.ts`** — domain types + helpers (`ACTIVE_STATES`,
  `nextStep`, `secondsLeft`, `timeAgo`, `LANGUAGES`, `KANPUR`). Reuse as-is.
- **`customer-app/src/lib/catalog.ts`** — static asset mapping for puja images +
  samagri. Keep the asset map; replace emoji glyphs with designed placeholders.
- **Polling/lifecycle logic** in `booking/[id]`, pandit `dashboard`, `job/[id]`
  — correct subscribe-style effects. Do not touch the data flow.
- **Status taxonomies** — customer `STATUS_COLORS` and pandit `STATUS_STYLE` map
  real backend statuses; consolidate into one `StatusIndicator` but keep the keys.

---

## 3. Inconsistencies / problems the redesign must fix

| # | Problem | Where |
|---|---------|-------|
| 1 | **Emoji used as UI icons** — tab bars (🏠📿🔔👤💰), buttons, headers (🙏📍🔍⚡🎟️⏱📡🌙✅⏳), ratings (★ as text), checkmarks (✓). ~24 files. | both apps, pervasive |
| 2 | **`theme.ts` diverged** between apps (customer has `addBg/tint*`; pandit has `online/offlineBg`). No semantic tokens, no dark mode, brand = forest-green + sunshine-yellow (not the premium emerald/gold target palette). | `*/src/theme.ts` |
| 3 | **`components/ui.tsx` diverged** — customer kit is Blinkit-style (499 lines, `PujaCard/GreenHeader/AddButton/QtyStepper`); pandit kit is different (240 lines, `Chip/WrapRow`, different `Button` variants/signature). `Button.onPress` is required in customer, optional in pandit; `Empty` takes `text` vs `{icon,title,sub}`. No single source of truth. | `*/src/components/ui.tsx` |
| 4 | **Ad-hoc inline styles** everywhere — most screens hand-roll spacing, radii, colors, shadows inline; magic numbers (`paddingTop: 54`, `height: 46`, `fontSize: 12.5`). No spacing scale, no type scale. | all screens |
| 5 | **Dishonest ETA copy** — home shows `"Panditji in 15 min"` and checkout `"Panditji in 15 minutes"` with no real availability/ETA behind it. Brief: do NOT promise 15-min arrival. | `customer (tabs)/index`, `book/[slug]` |
| 6 | **Flat emoji tab bar** — opaque `Tabs` bar, emoji icons at 0.5 opacity for inactive. No floating/glass treatment, weak active state. | `*/(tabs)/_layout.tsx` |
| 7 | **Rating stars are `★` text in sunshine-yellow** vs `colors.line`; no vector star, inconsistent with the rest. | `booking/[id]`, profiles, cards |
| 8 | **Inconsistent cards** — customer `PujaCard` thumb height 110, `addon` 74; pandit cards hand-rolled per screen; offer card inline. Card heights/aspect ratios not standardized. | both |
| 9 | **No skeletons / weak loading** — single centered spinner (`Loading`) for every data screen; no shimmer, no optimistic/empty/error parity. | both |
| 10 | **No animation/haptics/press polish** beyond `pressed` opacity; no transitions, no reduced-motion handling. | both |
| 11 | **Splash/login** use emoji 🕉️ in a rounded square, flat yellow/forest; not premium. | `index`, `login` |
| 12 | **Hardcoded demo location** shown as if real (`"Home · Gomti Nagar, Kanpur"`). Honest-ish (addresses screen says "demo") but presented inconsistently. | `customer (tabs)/index`, `book/[slug]` |

---

## 4. Real backend data (what we may show — nothing else)

All data comes from the FastAPI backend (`/api/v1/mp/...`). Confirmed response shapes:

- **`GET /discovery/services`** → `{ slug, title, summary, price_display, duration_label }`.
  `price_display` is `"₹1,500"` **or `"On request"`** when unpriced (see
  `backend/app/services/money.py`). The grid must honor "On request" — never invent a price.
- **`GET /discovery/pandits?service_slug&lat&lng`** → `{ id, name, languages[],
  distance_km, service_radius_km, rating_avg|null, rating_count }`. `rating_avg`
  is null for new Panditjis — show "New", never a fake number. `distance_km` is
  real (haversine vs. the query point). Only ONLINE, approved, in-radius, fresh-heartbeat
  Panditjis are returned, so an empty list is a real empty state.
- **`GET /customer/bookings` / `/bookings/{id}`** → booking with `code, status,
  service_title, price_display, address_line, assigned_pandit{name}`.
- **`GET /customer/bookings/{id}/tracking`** → `{ has_location, eta_minutes|null,
  freshness_seconds|null, is_stale, pandit_name|null }` — the ONLY real ETA source.
  Any ETA shown must come from here (and only while assigned + `has_location`).
- **`/bookings/{id}/events`** — status history.
- **`/customer/notifications`, `/addresses`, `/support/tickets`, `/profile`** — as used today.
- **Partner:** `/partner/profile` (Pandit incl. `availability, rating_avg,
  capabilities[]`), `/partner/bookings`, `/partner/booking-requests` (offers with
  `expires_at`), `/partner/location` (returns `eta_minutes`), `/partner/verification`
  (KYC docs + status), `/partner/notifications`, earnings derived from completed bookings.

**No fabricated ratings, ETAs, availability, counts, or prices.** Missing values →
honest placeholders ("New", "On request", empty states). The existing Kanpur demo
coordinate stays, labelled as a demo/preview location, until GPS is wired (out of scope).

---

## 5. In-flight PRs — conflict avoidance

- **PR #11** (full backend release, DB security/RLS, migrations): backend-only +
  `docs/`. **Zero overlap** with mobile UI work. Do not touch backend, do not run
  prod migrations, do not merge.
- **PR #12** (EAS config + app IDs): edits `*/app.json` (adds `ios.bundleIdentifier`,
  `android.package`, `extra.eas.projectId`, `owner`, and `"expo-status-bar"` to
  `plugins`), adds `*/eas.json`, and bumps some package versions in
  `package.json`/`package-lock.json`. **Overlap risk: `package.json` + `app.json`.**
  Mitigation:
  - New deps are **additive** to `package.json` `dependencies` (expo-blur,
    expo-linear-gradient, expo-haptics, expo-image, lucide-react-native,
    react-native-svg). A `package.json` merge is trivial (distinct lines).
  - **Do not edit `app.json`** (plugins/ios/android/extra) — none of the new libs
    require a config plugin (expo-blur, expo-linear-gradient, expo-haptics,
    expo-image, react-native-svg are autolinked; lucide is pure JS). This keeps
    `app.json` conflict-free with PR #12.
  - Dark-mode tokens are implemented in JS via `useColorScheme()`; `app.json`
    `userInterfaceStyle` is left as `"light"` (its current value, also set by the
    team) so the default runtime appearance is unchanged and PR #12 is not disturbed.

---

## 6. New dependencies (SDK-58 resolved via `npx expo install`)

| Package | Why |
|---------|-----|
| `lucide-react-native` + `react-native-svg` | Professional vector icon system (replaces all emoji UI icons). |
| `expo-blur` | Controlled glassmorphism (tab bar, headers, sheets, overlays) with a translucent fallback. |
| `expo-linear-gradient` | Emerald gradient CTAs + hero, premium stat cards. |
| `expo-haptics` | Tasteful press/selection/success haptics (guarded, native-only). |
| `expo-image` | Faster image loading + caching + designed placeholders for catalog media. |

No other native deps are added. All are Expo-recommended modules compatible with EAS.

---

## 7. Redesign approach — "shared" design system across two separate apps

The two apps are **independent Expo projects** (separate `node_modules`, separate
EAS projects). A true monorepo/metro-shared package would restructure both builds
and collide with PR #12's EAS config. Instead, the design system lives in a new
**`src/design/`** module authored once and **mirrored byte-identically into both
apps** (tokens, theme provider, icons, components). This is the "single source of
truth, reused by both apps" at the source level, with zero build-graph risk. The
mirrored files are documented in `docs/mobile/DESIGN-SYSTEM.md` and kept in sync.

`src/design/` layout:
```
design/
  tokens.ts        primitive + semantic tokens (light/dark), spacing, radius, type, elevation
  theme.tsx        ThemeProvider + useTheme() (useColorScheme-driven)
  icons.tsx        lucide icon wrapper + named app icon set
  glass.tsx        Glass surface (expo-blur + translucent fallback)
  components/       AppHeader, GlassTabBar, SearchBar, buttons, cards, badges,
                   BottomSheet, EmptyState, ErrorState, SkeletonLoader, FormInput,
                   Avatar, SectionHeader, PriceDisplay, StatusIndicator, etc.
  index.ts         barrel
```
The legacy `theme.ts` is kept as a thin re-export shim so untouched imports keep
working during the migration.

---

## 8. Phase plan (tracking)

- **P1** tokens (emerald/gold, light+dark, 4/8 spacing, type/radius/elevation, 44/48 touch)
- **P2** icon system (lucide), remove all emoji UI icons, designed media placeholders
- **P3** glassmorphism (blur + fallback) for tab bar/headers/sheets/overlays
- **P4** shared component library (centralized tokens, no ad-hoc screen styles)
- **P5** customer screens (home per brief, honest ETA/price, booking flow, etc.)
- **P6** partner screens (dashboard earnings/availability up front, KYC, lifecycle)
- **P7** floating glass bottom tab bars (vector icons, safe-area, Android fallback)
- **P8** animations/haptics/skeletons/pull-to-refresh, reduced-motion, perf
- **P9** QA: `tsc`/`expo lint`/`expo-doctor`, web + simulator screenshots, docs, PR
