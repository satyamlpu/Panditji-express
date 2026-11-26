# Mobile Redesign — Implementation Summary

Premium UI/UX redesign of both Expo apps, built on a shared design system. This
is UI/UX only: **all APIs, auth (phone+OTP), business logic and booking workflows
are preserved** — only the presentation layer changed. See
[`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md), [`REDESIGN-AUDIT.md`](./REDESIGN-AUDIT.md),
and [`REDESIGN-TEST-REPORT.md`](./REDESIGN-TEST-REPORT.md).

## What changed, by phase

- **P1 Tokens** — emerald/gold palette, semantic light+dark tokens, 4/8 spacing,
  radius/type/elevation scales, 44/48-pt touch targets. `src/design/tokens.ts`.
- **P2 Icons** — every emoji UI icon replaced with `lucide-react-native` vectors
  via a semantic registry (`src/design/icons.tsx`). Service media uses real backend
  photos with **designed neutral placeholders** (never emoji) when missing.
- **P3 Glass** — `expo-blur` `<Glass/>` with a translucent web/no-blur fallback,
  used sparingly (floating tab bar); headers use solid gradients for contrast.
- **P4 Component library** — centralized, token-driven components (buttons, cards,
  inputs, status, price, avatar, rating, skeletons, empty/error, headers, search,
  location, bottom sheet, tab bar, domain cards). No ad-hoc screen styles.
- **P5 Customer app** — every screen redesigned: splash, login/OTP, home,
  booking checkout (Book-now/Schedule), booking tracking, bookings list, alerts,
  profile, addresses, support, ticket.
- **P6 Partner app** — every screen redesigned: splash, login/OTP, dashboard
  (availability + earnings up front + requests), jobs, earnings, profile, job
  lifecycle (step tracker + live location), onboarding, KYC verification,
  notifications, support, ticket. Partner tab structure preserved.
- **P7 Tab bars** — floating `GlassTabBar` in both apps (Customer: Home · Bookings
  · Alerts · Profile; Partner: Home · My pujas · Earnings · Profile), vector icons,
  active pill, safe-area + content padding, Android translucent fallback.
- **P8 Interactions & performance** — press-scale + haptics, skeleton shimmer,
  pull-to-refresh, animated bottom sheet, `expo-image` transitions, all
  reduced-motion aware. Blur limited to one surface; `expo-image` caching; small
  lists render directly (no list virtualization needed at current data sizes);
  no unnecessary native deps.

## Honesty / no fabricated data

Every screen uses real backend data or an honest placeholder — verified against
the live backend:
- Prices render the backend `price_display`, including **"On request"** unchanged.
- Ratings show the real `rating_avg`, or **"New"** when the backend has none.
- Nearby-Panditji sections use the real discovery endpoint; when nobody is online
  they show an honest empty state (no invented Panditjis, distances or ETAs).
- No "15-minute arrival" promise — instant booking says *"we'll match the nearest
  available verified Panditji"*. Live ETA is shown only from the real tracking
  endpoint while a Panditji is assigned and sharing location.
- The Kanpur demo coordinate is retained and labelled a **preview location**.

## Preserved (unchanged behavior)

`src/lib/api.ts` (timeout/retry/401), `auth.tsx`, `storage.ts`, `i18n.tsx`,
`net.ts`/OfflineBanner logic, `pandit-app/src/lib/model.ts`, all endpoints, the
dispatch/booking lifecycle, polling cadences, KYC upload (`postForm` + image
picker), and the mock-payment flow. No backend, migration, or `app.json` changes.

## Dependencies added

`expo-blur`, `expo-linear-gradient`, `expo-haptics`, `expo-image`,
`lucide-react-native`, `react-native-svg` — Expo-recommended, EAS-compatible,
additive to `package.json`, resolved via `expo install`. Patch/minor versions were
aligned with `expo install --fix` to the SDK-58 expected releases (the same set
PR #12 bumps to).

## Known follow-ups (out of scope)

- Real GPS / geocoding to replace the Kanpur preview coordinate.
- Flipping `app.json` `userInterfaceStyle` to `"automatic"` to ship dark mode
  (tokens + components already support it).
- Optional: convert the longer lists to `FlatList`/`FlashList` if datasets grow.
- An EAS `preview` build + on-device pass before release.
