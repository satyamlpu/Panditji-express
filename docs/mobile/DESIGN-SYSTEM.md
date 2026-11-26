# Pandit Ji Express — Mobile Design System

The premium design system shared by both Expo apps (`customer-app/` and
`pandit-app/`). It lives in **`src/design/`** and is authored once, then mirrored
**byte-identically** into each app (see [Mirroring](#mirroring)).

> Identity: Apple-HIG structure + tasteful frosted glass + Rapido-style booking
> simplicity + a premium Indian-spiritual palette (deep emerald + sacred gold on
> warm ivory). Native system fonts, restrained weights, generous spacing.

---

## Files

```
src/design/
  tokens.ts            primitive palette · semantic light/dark colors · spacing · radius · type · elevation · touch targets
  theme.tsx            ThemeProvider · useTheme / useColors · useReducedMotion
  haptics.ts           safe expo-haptics wrapper (no-op on web)
  icons.tsx            lucide-react-native registry (semantic names) + <Icon/>
  glass.tsx            <Glass/> — expo-blur with translucent fallback
  components/
    primitives.tsx     Txt · PressableScale · Button (+ Primary/Secondary/Gradient) · Card · Chip · Divider · SectionHeader · WrapRow
    display.tsx        StatusIndicator · Badge · VerifiedBadge · PriceDisplay · Avatar · Rating · StarPicker
    feedback.tsx       Skeleton · SkeletonCard · SkeletonList · Loading · EmptyState · ErrorState · InlineError
    form.tsx           FormInput · Stepper · AddToggle
    chrome.tsx         AppHeader · SearchBar · LocationSelector
    sheet.tsx          BottomSheet
    cards.tsx          CatalogMedia · ServiceCard · PanditCard · BookingCard · NotificationCard
    tabbar.tsx         GlassTabBar · TAB_BAR_HEIGHT · TAB_BAR_SPACE
  index.ts             barrel (import everything from "../design")
```

A thin legacy `src/theme.ts` re-exports the old flat `colors`/`space`/`radius`/
`shadow` names mapped onto the new palette, so any un-migrated import still
compiles and stays on-brand.

---

## Tokens

### Palette (primitive)
| Role | Light | Dark |
|------|-------|------|
| Deep emerald | `#064E3B` | — |
| Primary emerald | `#059669` | `#10B981` |
| Sacred gold | `#D4AF37` | `#E6C565` |
| Page bg (ivory/night) | `#F8F9F6` | `#0B1511` |
| Surface | `#FFFFFF` | `#14211B` |
| Text | `#101C17` | `#ECF3EE` |
| Secondary text | `#718078` | `#9FB2A7` |
| Border | `#E2E8E3` | `#27372F` |
| Error / Warning / Success | `#DC2626` / `#D97706` / `#16A34A` | lightened variants |

Screens **never** use raw hex. They read **semantic tokens** via `useColors()` /
`useTheme()` (`colors.primary`, `colors.surface`, `colors.ink`, `colors.border`,
`colors.error`, …). Semantic tokens are defined for both light and dark.

### Scales
- **Spacing** — 4/8-pt: `spacing.xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 40` (plus `space(n)=n*4`).
- **Radius** — `xs 8 · sm 10 · md 14 · lg 18 · xl 24 · xxl 30 · pill 999`.
- **Type** — `display · h1 · h2 · h3 · bodyLg · body · bodyStrong · callout · label · caption · micro`. System fonts; weight `800` reserved for large numerals/display; most text is `400`–`700`. Dynamic type is respected (`allowFontScaling` left on).
- **Elevation** — `e1 / e2 / e3` (cross-platform shadow + Android elevation) and `none`.
- **Touch targets** — `MIN_TARGET` = 48dp Android / 44pt iOS; all tappable controls meet it; `hitSlop` helper for small glyph buttons.

### Theming (light + dark)
`ThemeProvider` resolves the active scheme from `useColorScheme()`. The apps ship
`userInterfaceStyle: "light"` in `app.json`, so the runtime default is light today;
flipping that one flag to `"automatic"` enables full dark mode with **no further
code change** (every screen already reads semantic tokens). `useReducedMotion()`
disables animations when the OS "Reduce Motion" setting is on.

---

## Icons (no emoji)

All UI icons are vector (`lucide-react-native` + `react-native-svg`). Screens use
**semantic names** from the registry so the icon library stays swappable:

```tsx
<Icon name="verified" size={16} color={colors.primary} />
```

Registry covers: `home, bookings, pujas, alerts, profile, earnings, location,
search, filters, back, forward, chevron, close, add, remove, check, refresh,
signout, settings, power, verified, shield, security, payments, wallet, calendar,
schedule, clock, navigation, rating, support, help, phone, language, camera,
samagri, offer, havan, blessing, warning, offline, night` (and more).

Religious categories / services use **real backend photography** via `CatalogMedia`;
when an image is missing it renders a **designed neutral placeholder** (emerald→gold
gradient + a vector glyph), never an emoji.

---

## Glassmorphism (controlled)

`<Glass/>` uses `expo-blur` on native and a **performant translucent fallback**
(`colors.glass` fill, no backdrop cost) on web / when blur is unavailable. It is
used sparingly — the floating tab bar, and available for sheets/overlays — never
behind body text where it would hurt contrast. Contextual headers use solid
emerald gradients (cheaper and higher-contrast) rather than blur.

---

## Components (highlights)

- **Button** — `primary · secondary · outline · danger · ghost · gradient`, sizes
  `sm/md/lg`, optional `icon`/`iconRight`, built-in press-scale + haptics.
- **Card** — standard surface; `onPress` makes it a pressable with scale feedback.
- **StatusIndicator** — one component maps every backend status (dispatch, pandit
  lifecycle, KYC, support) to a labelled, toned pill.
- **PriceDisplay** — renders the backend `price_display` string honestly, styling
  `"On request"` distinctly from a rupee amount. Never invents a price.
- **Rating** — shows a real `rating_avg`; renders **"New"** when the backend has none.
- **ServiceCard / PanditCard / BookingCard / NotificationCard** — consistent
  heights, vector icons, real data only.
- **SkeletonLoader / EmptyState / ErrorState / InlineError** — full loading /
  empty / error parity on every data screen.
- **GlassTabBar** — floating frosted bottom bar; vector icons; clear active pill;
  safe-area aware; Android translucent fallback. Screens pad content by
  `TAB_BAR_SPACE` so nothing hides under it.

### Interactions
`PressableScale` (spring press-scale), `haptics` (select/tap/success/warning/error),
`BottomSheet` (animated slide + scrim), skeleton shimmer, pull-to-refresh, and
`expo-image` fade-in transitions — all **reduced-motion aware**.

---

## Mirroring

The two apps are independent Expo projects, so the design system is kept
byte-identical in each rather than shared via a monorepo package (which would
collide with the EAS config in PR #12). To re-sync after editing in `customer-app`:

```bash
rm -rf pandit-app/src/design && cp -R customer-app/src/design pandit-app/src/design
diff -rq customer-app/src/design pandit-app/src/design   # must report identical
```

`src/theme.ts` (the legacy shim) is identical in both and synced the same way.

---

## New dependencies

`expo-blur`, `expo-linear-gradient`, `expo-haptics`, `expo-image`,
`lucide-react-native`, `react-native-svg` — all Expo-recommended, EAS-compatible,
resolved via `npx expo install`. No `app.json` plugin changes were needed (keeps
PR #12 conflict-free).
