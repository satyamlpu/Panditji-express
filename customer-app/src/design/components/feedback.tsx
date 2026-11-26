/**
 * Feedback + loading states: SkeletonLoader (shimmer), Loading, EmptyState,
 * ErrorState, InlineError. Shared design system — mirrored into both apps.
 */
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Animated, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing } from "../tokens";
import { useColors, useReducedMotion } from "../theme";
import { Icon, type IconName } from "../icons";
import { Txt, Button } from "./primitives";

/* ── Skeleton ───────────────────────────────────────────────────────────────── */
export function Skeleton({
  width,
  height = 14,
  rounded = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const pulse = useMemo(() => new Animated.Value(0.5), []);
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, reduced]);
  return (
    <Animated.View
      style={[
        {
          width: width as ViewStyle["width"],
          height,
          borderRadius: rounded,
          backgroundColor: colors.surfaceAlt,
          opacity: reduced ? 0.7 : pulse,
        },
        style,
      ]}
    />
  );
}

/** A reusable card-shaped skeleton for list/grid loading. */
export function SkeletonCard() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <Skeleton width="60%" height={16} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/* ── Loading ────────────────────────────────────────────────────────────────── */
export function Loading({ label }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.huge, backgroundColor: colors.bg, gap: spacing.md }}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Txt variant="callout" color={colors.inkSecondary}>{label}</Txt> : null}
    </View>
  );
}

/* ── Empty / Error ──────────────────────────────────────────────────────────── */
export function EmptyState({
  icon = "blessing",
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[{ alignItems: "center", paddingVertical: spacing.huge + 8, paddingHorizontal: spacing.xxl }, style]}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primaryTint,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}
      >
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Txt variant="h3" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" color={colors.inkSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
          {body}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.xl, alignSelf: "stretch", paddingHorizontal: spacing.huge }}>
          <Button label={actionLabel} onPress={onAction} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, backgroundColor: colors.bg }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.errorTint,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}
      >
        <Icon name="warning" size={30} color={colors.error} />
      </View>
      <Txt variant="h3" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" color={colors.inkSecondary} style={{ textAlign: "center", marginTop: spacing.sm }}>
          {body}
        </Txt>
      ) : null}
      {onRetry ? (
        <View style={{ marginTop: spacing.xl, alignSelf: "stretch", paddingHorizontal: spacing.huge }}>
          <Button label="Try again" icon="refresh" onPress={onRetry} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.errorTint,
        borderRadius: radius.md,
        padding: spacing.md,
      }}
    >
      <Icon name="warning" size={16} color={colors.error} />
      <Txt variant="callout" color={colors.error} style={{ flex: 1 }}>
        {message}
      </Txt>
    </View>
  );
}
