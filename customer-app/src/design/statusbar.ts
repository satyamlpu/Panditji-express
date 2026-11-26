/**
 * Focus-aware status bar style. The app's global bar is light (correct over the
 * emerald headers and native stack headers). Screens whose top is a light/surface
 * header (the secondary tabs) call this with "dark" so the status-bar glyphs stay
 * legible; on blur it resets to the light default. Shared design system.
 */
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";

export function useStatusBarStyle(style: "light" | "dark") {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
      return () => setStatusBarStyle("light", true);
    }, [style]),
  );
}
