/**
 * Form controls: FormInput, Stepper, AddToggle. Shared design system.
 */
import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MIN_TARGET, radius, spacing } from "../tokens";
import { useColors } from "../theme";
import { haptics } from "../haptics";
import { Icon, type IconName } from "../icons";
import { Txt, PressableScale } from "./primitives";

export function FormInput({
  label,
  icon,
  error,
  hint,
  style,
  ...props
}: {
  label?: string;
  icon?: IconName;
  error?: string | null;
  hint?: string;
  style?: StyleProp<ViewStyle>;
} & TextInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {label ? (
        <Txt variant="label" color={colors.inkSecondary} style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: props.multiline ? "flex-start" : "center",
          gap: spacing.sm,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          minHeight: props.multiline ? 96 : MIN_TARGET + 4,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? colors.primary : colors.inkMuted} /> : null}
        <TextInput
          placeholderTextColor={colors.inkMuted}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            flex: 1,
            fontSize: 16,
            color: colors.ink,
            paddingVertical: props.multiline ? spacing.md : 0,
            textAlignVertical: props.multiline ? "top" : "center",
          }}
          {...props}
        />
      </View>
      {error ? (
        <Txt variant="caption" color={colors.error} style={{ marginTop: 5 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: 5 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Stepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  const colors = useColors();
  const btn = (name: IconName, fn: () => void) => (
    <Pressable
      onPress={() => {
        haptics.select();
        fn();
      }}
      hitSlop={8}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={name} size={18} color={colors.onPrimary} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.primary,
        borderRadius: radius.sm,
        height: 36,
        paddingHorizontal: 2,
      }}
    >
      {btn("remove", onDec)}
      <Text style={{ color: colors.onPrimary, fontWeight: "800", fontSize: 14, minWidth: 20, textAlign: "center" }}>
        {qty}
      </Text>
      {btn("add", onInc)}
    </View>
  );
}

/** Pill toggle used for optional samagri selection (preference, not a charge). */
export function AddToggle({
  added,
  onPress,
  addLabel = "Add",
}: {
  added?: boolean;
  onPress: () => void;
  addLabel?: string;
}) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.94}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        minWidth: 76,
        height: 34,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: added ? colors.primary : colors.primaryTint,
      }}
    >
      {added ? <Icon name="check" size={15} color={colors.onPrimary} /> : null}
      <Text style={{ color: added ? colors.onPrimary : colors.primary, fontWeight: "700", fontSize: 13 }}>
        {added ? "Added" : addLabel}
      </Text>
    </PressableScale>
  );
}
