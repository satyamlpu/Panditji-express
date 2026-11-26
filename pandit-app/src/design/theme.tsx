/**
 * Theme runtime: resolves the active color scheme and exposes semantic tokens.
 * Shared design system — mirrored into both apps.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import {
  darkColors,
  lightColors,
  type ColorScheme,
  type SemanticColors,
} from "./tokens";

export interface Theme {
  scheme: ColorScheme;
  dark: boolean;
  colors: SemanticColors;
}

const ThemeCtx = createContext<Theme>({
  scheme: "light",
  dark: false,
  colors: lightColors,
});

/**
 * Follows the OS appearance. The apps currently ship `userInterfaceStyle: "light"`
 * in app.json, so this resolves to light at runtime today; flipping that one flag
 * to "automatic" turns on full dark support with no further code change.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "dark" ? "dark" : "light";
  const value = useMemo<Theme>(
    () => ({
      scheme,
      dark: scheme === "dark",
      colors: scheme === "dark" ? darkColors : lightColors,
    }),
    [scheme],
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
