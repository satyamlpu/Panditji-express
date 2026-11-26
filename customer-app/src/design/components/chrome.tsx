/**
 * App chrome: AppHeader (contextual), SearchBar, LocationSelector.
 * Shared design system — mirrored into both apps.
 */
import { type ReactNode } from "react";
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { hitSlop, MIN_TARGET, radius, spacing } from "../tokens";
import { useColors } from "../theme";
import { Icon } from "../icons";
import { Txt, PressableScale } from "./primitives";

/**
 * Contextual header rendered inside a screen (we keep expo-router's native stack
 * header styled separately). `tone="emerald"` is the premium hero treatment.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  tone = "surface",
  children,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  tone?: "surface" | "emerald";
  children?: ReactNode;
}) {
  const colors = useColors();
  const onEmerald = tone === "emerald";
  const fg = onEmerald ? colors.onDark : colors.ink;
  const subFg = onEmerald ? "rgba(234,243,236,0.8)" : colors.inkSecondary;
  return (
    <View
      style={{
        backgroundColor: onEmerald ? colors.primaryStrong : colors.surface,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: onEmerald ? spacing.lg : spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={hitSlop}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: -6 }}
          >
            <Icon name="back" size={24} color={fg} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {title ? (
            <Txt variant="h2" color={fg} numberOfLines={1}>
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt variant="caption" color={subFg} numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search pujas, samagri…",
  onSubmit,
  onFilter,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onFilter?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          height: MIN_TARGET + 4,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Icon name="search" size={18} color={colors.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={{ flex: 1, fontSize: 15, color: colors.ink }}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={hitSlop}>
          <Icon name="close" size={16} color={colors.inkMuted} />
        </Pressable>
      ) : onFilter ? (
        <Pressable onPress={onFilter} hitSlop={hitSlop}>
          <Icon name="filters" size={18} color={colors.inkSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Compact location row for headers. Honest: shows whatever label it's given
 * (incl. a "demo"/preview location) and signals it's tappable to change.
 */
export function LocationSelector({
  label,
  caption = "Deliver puja to",
  onPress,
  tone = "emerald",
}: {
  label: string;
  caption?: string;
  onPress?: () => void;
  tone?: "surface" | "emerald";
}) {
  const colors = useColors();
  const onEmerald = tone === "emerald";
  const fg = onEmerald ? colors.onDark : colors.ink;
  const subFg = onEmerald ? colors.accent : colors.inkSecondary;
  return (
    <PressableScale onPress={onPress} haptic="select" scaleTo={0.98} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
      <Icon name="location" size={18} color={subFg} />
      <View style={{ flex: 1 }}>
        <Txt variant="micro" color={subFg}>
          {caption.toUpperCase()}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Txt variant="bodyStrong" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Txt>
          <Icon name="expand" size={16} color={fg} />
        </View>
      </View>
    </PressableScale>
  );
}
