/**
 * Core primitives: typography, pressables, buttons, cards, chips, dividers,
 * section headers. All consume semantic tokens — no raw hex in screens.
 * Shared design system — mirrored into both apps.
 */
import { useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { elevation, MIN_TARGET, palette, radius, spacing, type as typeScale } from "../tokens";
import { useColors, useReducedMotion } from "../theme";
import { haptics } from "../haptics";
import { Icon, type IconName } from "../icons";

/* ── Typography ─────────────────────────────────────────────────────────────── */
type TypeVariant = keyof typeof typeScale;
export function Txt({
  variant = "body",
  color,
  style,
  children,
  ...rest
}: {
  variant?: TypeVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
} & TextProps) {
  const colors = useColors();
  return (
    <Text style={[typeScale[variant], { color: color ?? colors.ink }, style]} {...rest}>
      {children}
    </Text>
  );
}

/* ── PressableScale ─────────────────────────────────────────────────────────── */
export function PressableScale({
  children,
  onPress,
  haptic = "tap",
  scaleTo = 0.97,
  disabled,
  style,
  ...rest
}: {
  children: ReactNode;
  onPress?: () => void;
  haptic?: keyof typeof haptics | "none";
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, "onPress" | "style">) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => !reduced && spring(scaleTo)}
      onPressOut={() => !reduced && spring(1)}
      onPress={() => {
        if (haptic !== "none") haptics[haptic]();
        onPress?.();
      }}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale: reduced ? 1 : scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ── Button ─────────────────────────────────────────────────────────────────── */
export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "gradient";
export type ButtonSize = "sm" | "md" | "lg";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  disabled,
  full = true,
  haptic = "tap",
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  haptic?: keyof typeof haptics | "none";
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const isOff = disabled || loading;
  const height = size === "lg" ? 54 : size === "sm" ? Math.max(40, MIN_TARGET - 4) : MIN_TARGET + 4;
  const fontSize = size === "sm" ? 14 : 16;

  const fg =
    variant === "outline" || variant === "ghost"
      ? colors.primary
      : variant === "gradient" || variant === "primary" || variant === "danger"
        ? colors.onPrimary
        : colors.primary;
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.primaryTint
        : variant === "danger"
          ? colors.error
          : "transparent";
  const secFg = variant === "secondary" ? colors.primary : fg;

  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        height,
        paddingHorizontal: size === "sm" ? spacing.lg : spacing.xl,
      }}
    >
      {loading ? (
        <ActivityIndicator color={variant === "gradient" || variant === "primary" || variant === "danger" ? colors.onPrimary : colors.primary} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={fontSize + 3} color={secFg} /> : null}
          <Text style={{ color: secFg, fontWeight: "700", fontSize }}>{label}</Text>
          {iconRight ? <Icon name={iconRight} size={fontSize + 3} color={secFg} /> : null}
        </>
      )}
    </View>
  );

  const shape: ViewStyle = {
    borderRadius: radius.md,
    overflow: "hidden",
    opacity: isOff ? 0.5 : 1,
    alignSelf: full ? "stretch" : "flex-start",
    borderWidth: variant === "outline" ? 1.5 : 0,
    borderColor: colors.primary,
    ...(variant === "primary" || variant === "danger" || variant === "gradient" ? elevation.e1 : {}),
  };

  return (
    <PressableScale onPress={onPress} disabled={isOff} haptic={haptic} style={[shape, { backgroundColor: bg }, style]}>
      {variant === "gradient" ? (
        <LinearGradient
          colors={[palette.emerald, palette.emeraldDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </PressableScale>
  );
}

export const PrimaryButton = (p: Omit<Parameters<typeof Button>[0], "variant">) => (
  <Button variant="primary" {...p} />
);
export const SecondaryButton = (p: Omit<Parameters<typeof Button>[0], "variant">) => (
  <Button variant="outline" {...p} />
);
export const GradientButton = (p: Omit<Parameters<typeof Button>[0], "variant">) => (
  <Button variant="gradient" {...p} />
);

/* ── Card ───────────────────────────────────────────────────────────────────── */
export function Card({
  children,
  style,
  onPress,
  padded = true,
  elevated = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
}) {
  const colors = useColors();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: padded ? spacing.lg : 0,
    ...(elevated ? elevation.e1 : {}),
  };
  if (onPress) {
    return (
      <PressableScale onPress={onPress} haptic="select" style={[base, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/* ── Chip ───────────────────────────────────────────────────────────────────── */
export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.95}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 38,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryTint : colors.surface,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      {selected ? <Icon name="check" size={15} color={colors.primary} /> : icon ? (
        <Icon name={icon} size={15} color={colors.inkSecondary} />
      ) : null}
      <Text style={{ color: selected ? colors.primary : colors.inkSecondary, fontWeight: "600", fontSize: 13 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ── Divider + Section header ─────────────────────────────────────────────────── */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
        style,
      ]}
    >
      <Txt variant="h3">{title}</Txt>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{actionLabel}</Text>
          <Icon name="chevron" size={15} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Wrapping row ───────────────────────────────────────────────────────────── */
export function WrapRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", flexWrap: "wrap" }, style]}>{children}</View>;
}
