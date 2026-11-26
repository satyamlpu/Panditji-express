/**
 * Display components: StatusIndicator, VerifiedBadge, PriceDisplay, Avatar,
 * Rating, Badge. Shared design system — mirrored into both apps.
 */
import { type ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing } from "../tokens";
import { useColors, type Theme } from "../theme";
import { useTheme } from "../theme";
import { Icon } from "../icons";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral" | "info" | "accent";

function toneColors(colors: Theme["colors"], tone: Tone) {
  switch (tone) {
    case "primary":
      return { fg: colors.primary, bg: colors.primaryTint };
    case "success":
      return { fg: colors.success, bg: colors.successTint };
    case "warning":
      return { fg: colors.warning, bg: colors.warningTint };
    case "danger":
      return { fg: colors.error, bg: colors.errorTint };
    case "info":
      return { fg: colors.info, bg: colors.infoTint };
    case "accent":
      return { fg: colors.onAccent, bg: colors.accentTint };
    default:
      return { fg: colors.inkSecondary, bg: colors.surfaceAlt };
  }
}

/* Backend status → human label + tone. Covers customer + partner + KYC + support. */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  // dispatch / booking
  searching: { label: "Finding Panditji", tone: "warning" },
  awaiting_acceptance: { label: "Awaiting Panditji", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "info" },
  en_route: { label: "On the way", tone: "primary" },
  arrived: { label: "Arrived", tone: "primary" },
  in_progress: { label: "In progress", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  no_partner_available: { label: "No Panditji available", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled_customer: { label: "Cancelled", tone: "neutral" },
  cancelled_partner: { label: "Cancelled", tone: "neutral" },
  cancelled_platform: { label: "Cancelled", tone: "neutral" },
  // pandit lifecycle
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Under review", tone: "warning" },
  under_review: { label: "Under review", tone: "warning" },
  action_required: { label: "Action needed", tone: "danger" },
  approved: { label: "Approved", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  // support
  open: { label: "Open", tone: "info" },
  pending: { label: "Pending", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export function StatusIndicator({ status, style }: { status: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const meta = STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as Tone };
  const { fg, bg } = toneColors(colors, meta.tone);
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          alignSelf: "flex-start",
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        style,
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={{ color: fg, fontWeight: "700", fontSize: 12 }}>{meta.label}</Text>
    </View>
  );
}

export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: Tone; icon?: ReactNode }) {
  const colors = useColors();
  const { fg, bg } = toneColors(colors, tone);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 3,
      }}
    >
      {icon}
      <Text style={{ color: fg, fontWeight: "700", fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

export function VerifiedBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const colors = useColors();
  const s = size === "sm" ? 13 : 15;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name="verified" size={s} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size === "sm" ? 11.5 : 12.5 }}>
        Verified
      </Text>
    </View>
  );
}

/** Renders the backend `price_display` string ("₹1,500" or "On request") honestly. */
export function PriceDisplay({
  value,
  size = "md",
  note,
}: {
  value: string;
  size?: "sm" | "md" | "lg";
  note?: string;
}) {
  const colors = useColors();
  const onRequest = /request/i.test(value);
  const fontSize = size === "lg" ? 20 : size === "sm" ? 14 : 16;
  return (
    <View>
      <Text
        style={{
          color: onRequest ? colors.inkSecondary : colors.ink,
          fontWeight: onRequest ? "600" : "800",
          fontSize: onRequest ? fontSize - 2 : fontSize,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {note ? <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 1 }}>{note}</Text> : null}
    </View>
  );
}

export function Avatar({
  name,
  size = 44,
  icon = "profile",
}: {
  name?: string | null;
  size?: number;
  icon?: "profile" | "blessing";
}) {
  const { colors } = useTheme();
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryTint,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.glassBorder,
      }}
    >
      {initials ? (
        <Text style={{ color: colors.primary, fontWeight: "800", fontSize: size * 0.36 }}>{initials}</Text>
      ) : (
        <Icon name={icon} size={size * 0.5} color={colors.primary} />
      )}
    </View>
  );
}

/** Rating — shows real rating_avg, or "New" when the backend has none. */
export function Rating({
  value,
  count,
  size = 14,
}: {
  value: number | null | undefined;
  count?: number;
  size?: number;
}) {
  const colors = useColors();
  if (value == null) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name="rating" size={size} color={colors.inkMuted} />
        <Text style={{ color: colors.inkSecondary, fontSize: size - 1, fontWeight: "600" }}>New</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name="rating" size={size} color={colors.star} fill={colors.star} strokeWidth={0} />
      <Text style={{ color: colors.ink, fontSize: size - 1, fontWeight: "700" }}>
        {value.toFixed(1)}
      </Text>
      {count != null && count > 0 ? (
        <Text style={{ color: colors.inkMuted, fontSize: size - 2 }}>({count})</Text>
      ) : null}
    </View>
  );
}

/** Interactive star rating for the review form. */
export function StarPicker({
  value,
  onChange,
  size = 34,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
          suppressHighlighting
        >
          <Icon
            name="rating"
            size={size}
            color={n <= value ? colors.star : colors.starTrack}
            fill={n <= value ? colors.star : "none"}
            strokeWidth={n <= value ? 0 : 2}
          />
        </Text>
      ))}
    </View>
  );
}
