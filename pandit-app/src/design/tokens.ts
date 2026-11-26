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
 * Premium Indian-spiritual identity: deep emerald + sacred gold on warm ivory. */
export const palette = {
  // Emerald family
  emeraldDeep: "#064E3B", // deep emerald — headers, hero, dark primary
  emerald700: "#047857",
  emerald: "#059669", // primary emerald — CTAs, active state
  emerald500: "#10B981",
  emerald400: "#34D399",
  emeraldTint: "#E7F3EE", // soft emerald wash (chips, selected)
  emeraldTintDk: "#123A2C",

  // Sacred gold family
  gold: "#D4AF37",
  goldSoft: "#E6C565",
  goldTint: "#FBF3DC",
  goldTintDk: "#3A3016",

  // Warm neutrals (light)
  ivory: "#F8F9F6", // page background
  surface: "#FFFFFF",
  surfaceAlt: "#F1F3EE", // subtle raised/alt surface
  ink: "#101C17", // primary text
  inkSecondary: "#718078", // secondary text
  inkMuted: "#9AA79F",
  border: "#E2E8E3",
  borderStrong: "#CBD5CE",

  // Dark neutrals
  night: "#0B1511", // page background (dark)
  nightSurface: "#14211B",
  nightSurfaceAlt: "#1C2C25",
  nightInk: "#ECF3EE",
  nightInkSecondary: "#9FB2A7",
  nightInkMuted: "#6F8279",
  nightBorder: "#27372F",
  nightBorderStrong: "#35493E",

  // Status
  error: "#DC2626",
  errorTint: "#FDECEC",
  errorTintDk: "#3A1715",
  warning: "#D97706",
  warningTint: "#FBF0DF",
  warningTintDk: "#3A2A12",
  success: "#16A34A",
  successTint: "#E7F6EC",
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
  glass: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(16,28,23,0.08)",
  scrim: "rgba(8,16,12,0.45)",

  primary: palette.emerald,
  primaryStrong: palette.emeraldDeep,
  primaryPressed: palette.emerald700,
  onPrimary: palette.white,
  primaryTint: palette.emeraldTint,

  accent: palette.gold,
  accentTint: palette.goldTint,
  onAccent: "#3A2E05",

  ink: palette.ink,
  inkSecondary: palette.inkSecondary,
  inkMuted: palette.inkMuted,
  onDark: "#EAF3EC",

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
  glass: "rgba(20,33,27,0.66)",
  glassBorder: "rgba(255,255,255,0.08)",
  scrim: "rgba(0,0,0,0.6)",

  primary: palette.emerald500,
  primaryStrong: palette.emerald,
  primaryPressed: palette.emerald400,
  onPrimary: "#04231A",
  primaryTint: palette.emeraldTintDk,

  accent: palette.goldSoft,
  accentTint: palette.goldTintDk,
  onAccent: "#1D1702",

  ink: palette.nightInk,
  inkSecondary: palette.nightInkSecondary,
  inkMuted: palette.nightInkMuted,
  onDark: "#EAF3EC",

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
