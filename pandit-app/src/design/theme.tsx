/**
 * Theme runtime: resolves the active color scheme and exposes semantic tokens.
 * Supports an in-app preference — System (follow the OS), Light or Dark —
 * persisted per device. Shared design system — mirrored into both apps.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import {
  darkColors,
  lightColors,
  type ColorScheme,
  type SemanticColors,
} from "./tokens";

/** User's theme choice. "system" follows the OS appearance. */
export type ThemePref = "system" | "light" | "dark";

const THEME_PREF_KEY = "pje_theme_pref"; // a UI preference, not a secret → AsyncStorage

export interface Theme {
  scheme: ColorScheme;
  dark: boolean;
  colors: SemanticColors;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}

const ThemeCtx = createContext<Theme>({
  scheme: "light",
  dark: false,
  colors: lightColors,
  pref: "system",
  setPref: () => {},
});

/**
 * Resolves the active scheme from the user's saved preference, falling back to
 * the OS appearance when the preference is "system" (the default). Both apps
 * ship `userInterfaceStyle: "automatic"`, so "system" tracks the device.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");

  // Load the saved preference once on mount (async; defaults to "system").
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_PREF_KEY)
      .then((v) => {
        if (active && (v === "light" || v === "dark" || v === "system")) {
          setPrefState(v);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(THEME_PREF_KEY, p).catch(() => {});
  }, []);

  const scheme: ColorScheme =
    pref === "system" ? (system === "dark" ? "dark" : "light") : pref;

  const value = useMemo<Theme>(
    () => ({
      scheme,
      dark: scheme === "dark",
      colors: scheme === "dark" ? darkColors : lightColors,
      pref,
      setPref,
    }),
    [scheme, pref, setPref],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeCtx);
}

/** Convenience: semantic colors for the active scheme. */
export function useColors(): SemanticColors {
  return useContext(ThemeCtx).colors;
}

/** The theme preference and its setter, for an in-app Light/Dark/System switch. */
export function useThemePreference(): { pref: ThemePref; setPref: (p: ThemePref) => void } {
  const { pref, setPref } = useContext(ThemeCtx);
  return { pref, setPref };
}

/** Respects the OS "Reduce Motion" setting so animations can be disabled. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => active && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduced(v),
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
