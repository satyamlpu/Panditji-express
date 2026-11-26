/**
 * Controlled glassmorphism. Uses expo-blur on native; falls back to a performant
 * translucent surface on web and when the platform can't blur. Kept intentionally
 * sparing — tab bar, contextual headers, sheets and overlays only.
 * Shared design system — mirrored into both apps.
 */
import { type ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "./theme";

const supportsBlur = Platform.OS === "ios" || Platform.OS === "android";

export function Glass({
  children,
  intensity = 24,
  style,
  radius,
  bordered = true,
}: {
  children?: ReactNode;
  intensity?: number;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  bordered?: boolean;
}) {
  const { colors, dark } = useTheme();
  const shape: ViewStyle = {
    borderRadius: radius,
    overflow: "hidden",
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.glassBorder,
  };

  if (supportsBlur) {
    return (
      <BlurView
        intensity={intensity}
        tint={dark ? "dark" : "light"}
        style={[shape, style]}
      >
        {/* subtle wash lifts contrast so content stays legible over bright media */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass, opacity: 0.5 }]} />
        {children}
      </BlurView>
    );
  }

  // Web / no-blur fallback: opaque-enough translucent fill, no backdrop cost.
  return <View style={[shape, { backgroundColor: colors.glass }, style]}>{children}</View>;
}
