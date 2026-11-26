/**
 * Pandit Ji Express — shared design tokens.
 *
 * SINGLE SOURCE OF TRUTH for both apps (customer-app + pandit-app). This file is
 * authored once and mirrored byte-identically into each app's `src/design/`.
 * Do not hand-edit one copy — change here and re-sync (see docs/mobile/DESIGN-SYSTEM.md).
 *
 * Layers: primitive palette → semantic tokens (light + dark) → scales
 * (spacing / radius / type / elevation). Screens consume SEMANTIC tokens via
 * `useTheme()`, never raw hex.
 */
import { Platform } from "react-native";

/* ── Primitive palette ──────────────────────────────────────────────────────
 * Pandit Ji Express brand v2.0 — matches the real logo & website: Kumkum
 * Crimson (primary) + Agni Saffron + Swarna Gold on Parchment Ivory. The diya
 * flame in the logo drives the gold accents; success stays green (verified). */
export const palette = {
  // Kumkum Crimson family — primary brand (headers, hero, CTAs, active state)
  crimsonDeep: "#6A1018", // deep maroon — gradient end / dark headers
  crimson700: "#7A141B", // pressed / hover
  crimson: "#9A1C24", // primary brand
  crimson500: "#B23540",
  crimson400: "#C85862",
  crimsonTint: "#F7E8E6", // soft crimson wash (chips, selected)
  crimsonTintDk: "#3A1518",

  // Saffron + Swarna Gold — accents, ornaments, the diya flame
  saffron: "#D2600C",
  saffronDark: "#B0500A",
  gold: "#F5AE1E",
  goldSoft: "#E8C876",
  goldTint: "#FBF0D9",
  goldTintDk: "#3A2E12",

  // Warm neutrals (light) — Parchment Ivory + Kohl Charcoal
  ivory: "#FBF5EA", // page background
  surface: "#FFFFFF",
  surfaceAlt: "#FAF2E4", // subtle raised/alt surface
  ink: "#1B1512", // Kohl Charcoal — primary text
  inkSecondary: "#5A4D44", // Ash — secondary text
  inkMuted: "#8A7B70",
  border: "#EAD9C4", // warm ivory border
  borderStrong: "#DCC7AB",

  // Dark neutrals — warm charcoal / brown
  night: "#17100D", // page background (dark)
  nightSurface: "#211712",
  nightSurfaceAlt: "#2C1F18",
  nightInk: "#F6ECE0",
  nightInkSecondary: "#C6B4A5",
  nightInkMuted: "#8F7E71",
  nightBorder: "#392A20",
  nightBorderStrong: "#4A382C",

  // Status (success stays green per brand — verified / completed / online)
  error: "#DC2626",
  errorTint: "#FDECEC",
  errorTintDk: "#3A1715",
  warning: "#D97706",
  warningTint: "#FBF0DF",
  warningTintDk: "#3A2A12",
  success: "#1C7A3F",
  successTint: "#E7F3EA",
  successTintDk: "#13301F",
  info: "#2563EB",
  infoTint: "#E8F0FE",
  infoTintDk: "#16233F",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export type ColorScheme = "light" | "dark";

/** Semantic token shape — identical keys across light + dark. */
export interface SemanticColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  /** translucent fill behind blur / glass fallback */
  glass: string;
  glassBorder: string;
  /** scrim behind modals & sheets */
  scrim: string;

  primary: string;
  primaryStrong: string; // deep emerald
  primaryPressed: string;
  onPrimary: string;
  primaryTint: string; // soft wash for selected/active backgrounds

  accent: string; // sacred gold
  accentTint: string;
  onAccent: string;

  ink: string;
  inkSecondary: string;
  inkMuted: string;
  onDark: string; // text on emerald/dark headers

  border: string;
  borderStrong: string;

  error: string;
  errorTint: string;
  warning: string;
  warningTint: string;
  success: string;
  successTint: string;
  info: string;
  infoTint: string;

  /** star / rating glyph */
  star: string;
  starTrack: string;
}

export const lightColors: SemanticColors = {
  bg: palette.ivory,
  surface: palette.surface,
  surfaceAlt: palette.surfaceAlt,
  glass: "rgba(255,255,255,0.74)",
  glassBorder: "rgba(27,21,18,0.08)",
  scrim: "rgba(20,10,8,0.5)",

  primary: palette.crimson,
  primaryStrong: palette.crimsonDeep,
  primaryPressed: palette.crimson700,
  onPrimary: palette.white,
  primaryTint: palette.crimsonTint,

  accent: palette.gold,
  accentTint: palette.goldTint,
  onAccent: "#4A3500",

  ink: palette.ink,
  inkSecondary: palette.inkSecondary,
  inkMuted: palette.inkMuted,
  onDark: "#FBEFE0",

  border: palette.border,
  borderStrong: palette.borderStrong,

  error: palette.error,
  errorTint: palette.errorTint,
  warning: palette.warning,
  warningTint: palette.warningTint,
  success: palette.success,
  successTint: palette.successTint,
  info: palette.info,
  infoTint: palette.infoTint,

  star: palette.gold,
  starTrack: palette.border,
};

export const darkColors: SemanticColors = {
  bg: palette.night,
  surface: palette.nightSurface,
  surfaceAlt: palette.nightSurfaceAlt,
  glass: "rgba(33,23,18,0.66)",
  glassBorder: "rgba(255,255,255,0.08)",
  scrim: "rgba(0,0,0,0.62)",

  primary: palette.crimson500,
  primaryStrong: palette.crimson,
  primaryPressed: palette.crimson400,
  onPrimary: palette.white,
  primaryTint: palette.crimsonTintDk,

  accent: palette.goldSoft,
  accentTint: palette.goldTintDk,
  onAccent: "#1D1702",

  ink: palette.nightInk,
  inkSecondary: palette.nightInkSecondary,
  inkMuted: palette.nightInkMuted,
  onDark: "#FBEFE0",

  border: palette.nightBorder,
  borderStrong: palette.nightBorderStrong,

  error: "#F87171",
  errorTint: palette.errorTintDk,
  warning: "#FBBF24",
  warningTint: palette.warningTintDk,
  success: "#4ADE80",
  successTint: palette.successTintDk,
  info: "#60A5FA",
  infoTint: palette.infoTintDk,

  star: palette.goldSoft,
  starTrack: palette.nightBorderStrong,
};

export const schemes: Record<ColorScheme, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
};

/* ── Spacing (4 / 8 pt) ─────────────────────────────────────────────────────── */
export const space = (n: number) => n * 4;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/* ── Radius ─────────────────────────────────────────────────────────────────── */
export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

/* ── Type scale ───────────────────────────────────────────────────────────────
 * Native system fonts (San Francisco / Roboto) via `undefined` fontFamily.
 * Weights are deliberately restrained — 800 only for large numerals/display.
 * Sizes honour dynamic type (components keep allowFontScaling on). */
export type TypeToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  letterSpacing?: number;
};
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5 },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: "700" },
  bodyLg: { fontSize: 16, lineHeight: 23, fontWeight: "400" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.3 },
} satisfies Record<string, TypeToken>;

/* ── Elevation ──────────────────────────────────────────────────────────────── */
export const elevation = {
  none: {},
  e1: {
    shadowColor: "#0B2016",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  e2: {
    shadowColor: "#0B2016",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  e3: {
    shadowColor: "#0B2016",
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/* ── Touch targets ──────────────────────────────────────────────────────────── */
export const MIN_TARGET = Platform.OS === "android" ? 48 : 44;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

/* ── Timing ─────────────────────────────────────────────────────────────────── */
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
} as const;
