import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { colors, radius, shadow } from "../theme";

/* ── Buttons ──────────────────────────────────────────────────────────────── */
type Variant = "primary" | "accent" | "outline" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === "primary"
      ? colors.forest
      : variant === "accent"
        ? colors.carrot
        : variant === "danger"
          ? colors.tomato
          : "transparent";
  const fg = variant === "outline" ? colors.forest : colors.white;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderWidth: variant === "outline" ? 1.5 : 0,
        borderColor: colors.forest,
        borderRadius: radius.md,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: "800", fontSize: 16 }}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 16,
          ...shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ── Field ────────────────────────────────────────────────────────────────── */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ color: colors.ink, fontWeight: "700", marginBottom: 6, fontSize: 13 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radius.sm,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.ink,
          backgroundColor: colors.surface,
          minHeight: multiline ? 88 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

/* ── Selectable chip (languages, services) ────────────────────────────────── */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.forest : colors.line,
        backgroundColor: selected ? colors.onlineBg : colors.surface,
        marginRight: 8,
        marginBottom: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: selected ? colors.forest : colors.muted, fontWeight: "700", fontSize: 13 }}>
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Section header ───────────────────────────────────────────────────────── */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 20,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{title}</Text>
      {action}
    </View>
  );
}

/* ── Status pill (booking + pandit status) ────────────────────────────────── */
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  // pandit lifecycle
  draft: { bg: colors.offlineBg, fg: colors.muted, label: "Draft" },
  submitted: { bg: colors.tintSaffron, fg: colors.gold, label: "Under review" },
  under_review: { bg: colors.tintSaffron, fg: colors.gold, label: "Under review" },
  action_required: { bg: colors.tintRose, fg: colors.maroon, label: "Action needed" },
  approved: { bg: colors.onlineBg, fg: colors.online, label: "Approved" },
  rejected: { bg: colors.tintRose, fg: colors.tomato, label: "Rejected" },
  suspended: { bg: colors.tintRose, fg: colors.tomato, label: "Suspended" },
  // booking lifecycle
  confirmed: { bg: colors.tintBlue, fg: colors.forest, label: "Confirmed" },
  en_route: { bg: colors.tintSaffron, fg: colors.gold, label: "On the way" },
  arrived: { bg: colors.tintSaffron, fg: colors.gold, label: "Arrived" },
  in_progress: { bg: colors.tintSaffron, fg: colors.carrot, label: "In progress" },
  completed: { bg: colors.onlineBg, fg: colors.online, label: "Completed" },
  cancelled_customer: { bg: colors.tintRose, fg: colors.tomato, label: "Cancelled" },
  cancelled_partner: { bg: colors.tintRose, fg: colors.tomato, label: "Cancelled" },
  cancelled_platform: { bg: colors.tintRose, fg: colors.tomato, label: "Cancelled" },
  no_partner_available: { bg: colors.tintRose, fg: colors.tomato, label: "No partner" },
  expired: { bg: colors.offlineBg, fg: colors.muted, label: "Expired" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: colors.offlineBg, fg: colors.muted, label: status };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 }}>
      <Text style={{ color: s.fg, fontWeight: "800", fontSize: 12 }}>{s.label}</Text>
    </View>
  );
}

/* ── Loading / Empty ──────────────────────────────────────────────────────── */
export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.forest} size="large" />
    </View>
  );
}

export function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 40, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, textAlign: "center" }}>{title}</Text>
      {sub ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 20 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

/* ── Wrapping chip/row container ──────────────────────────────────────────── */
export function WrapRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{children}</View>;
}

export { ScrollView };
