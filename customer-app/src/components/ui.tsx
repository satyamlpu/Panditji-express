import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radius, shadow } from "../theme";
import { DEFAULT_GLYPH, PUJA_GLYPH, PUJA_IMAGES } from "../lib/catalog";

/* ─── Primitives ─────────────────────────────────────────────── */

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "accent" | "outline";
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === "accent" ? colors.tomato : variant === "outline" ? "transparent" : colors.forest;
  const fg = variant === "outline" ? colors.forest : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.forest },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.forest} size="large" />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ color: colors.muted, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

/* ─── Status pill ────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  confirmed: colors.forest,
  completed: colors.forest,
  en_route: colors.carrot,
  arrived: colors.carrot,
  in_progress: colors.carrot,
  awaiting_acceptance: colors.gold,
  searching: colors.gold,
  no_partner_available: colors.tomato,
  cancelled_customer: colors.muted,
};

export function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: c + "1f", borderColor: c + "55" }]}>
      <Text style={{ color: c, fontSize: 11.5, fontWeight: "800", textTransform: "capitalize" }}>
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

/* ─── Blinkit-style header ───────────────────────────────────── */

export function GreenHeader({
  etaText,
  location,
  onProfile,
}: {
  etaText: string;
  location: string;
  onProfile?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.etaText}>{etaText}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Text style={{ color: colors.sunshine, fontSize: 12 }}>📍 </Text>
          <Text style={styles.locText} numberOfLines={1}>
            {location}
          </Text>
        </View>
      </View>
      <Pressable onPress={onProfile} style={styles.profileBtn}>
        <Text style={{ fontSize: 18 }}>🙏</Text>
      </Pressable>
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search pujas, samagri…",
  onSubmit,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.search}>
      <Text style={{ fontSize: 15, marginRight: 8 }}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        returnKeyType="search"
      />
    </View>
  );
}

/* ─── Thumbnails ─────────────────────────────────────────────── */

export function Thumb({ slug, size = 96 }: { slug: string; size?: number }) {
  const img = PUJA_IMAGES[slug];
  if (img) {
    return (
      <Image source={img} resizeMode="contain" style={{ width: size, height: size }} />
    );
  }
  const g = PUJA_GLYPH[slug] ?? DEFAULT_GLYPH;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: g.tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.42 }}>{g.glyph}</Text>
    </View>
  );
}

/* ─── Add button + stepper ───────────────────────────────────── */

export function AddButton({
  label = "Book",
  onPress,
  added,
}: {
  label?: string;
  onPress: () => void;
  added?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.add,
        added
          ? { backgroundColor: colors.forest, borderColor: colors.forest }
          : { backgroundColor: colors.addBg, borderColor: colors.addBorder },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={{ color: added ? colors.white : colors.addText, fontWeight: "800", fontSize: 13 }}>
        {added ? "✓ Added" : label}
      </Text>
    </Pressable>
  );
}

export function QtyStepper({
  qty,
  onDec,
  onInc,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepSign}>–</Text>
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable onPress={onInc} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

/* ─── Puja grid card ─────────────────────────────────────────── */

export function PujaCard({
  title,
  meta,
  price,
  slug,
  onBook,
}: {
  title: string;
  meta?: string | null;
  price: string;
  slug: string;
  onBook: () => void;
}) {
  return (
    <View style={styles.pcard}>
      <View style={styles.pthumb}>
        <Thumb slug={slug} size={104} />
      </View>
      <Text style={styles.ptitle} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={styles.pmeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      <View style={styles.prow}>
        <Text style={styles.pprice} numberOfLines={1}>
          {price}
        </Text>
        <AddButton onPress={onBook} />
      </View>
    </View>
  );
}

/* ─── Category tile + promo banner + section header ──────────── */

export function CategoryTile({
  label,
  glyph,
  tint,
  active,
  onPress,
}: {
  label: string;
  glyph: string;
  tint: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", width: 72, marginRight: 10 }}>
      <View
        style={[
          styles.cat,
          { backgroundColor: tint },
          active && { borderWidth: 2, borderColor: colors.forest },
        ]}
      >
        <Text style={{ fontSize: 28 }}>{glyph}</Text>
      </View>
      <Text style={styles.catLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PromoBanner({
  title,
  sub,
  bg,
  fg,
}: {
  title: string;
  sub: string;
  bg: string;
  fg: string;
}) {
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: fg, opacity: 0.92, marginTop: 4, fontSize: 13 }}>{sub}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction}>
          <Text style={styles.seeAll}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  btnText: { fontSize: 16, fontWeight: "800" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadow,
  },
  label: { color: colors.ink, fontWeight: "700", marginBottom: 6, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  empty: {
    padding: 28,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },

  header: {
    backgroundColor: colors.forest,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  etaText: { color: colors.white, fontSize: 18, fontWeight: "800" },
  locText: { color: "#dceadd", fontSize: 12.5, maxWidth: 240 },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff22",
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink },

  add: {
    minWidth: 74,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.forest,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    height: 34,
  },
  stepBtn: { width: 28, alignItems: "center", justifyContent: "center" },
  stepSign: { color: colors.white, fontSize: 18, fontWeight: "800" },
  stepQty: { color: colors.white, fontSize: 14, fontWeight: "800", minWidth: 18, textAlign: "center" },

  pcard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    ...shadow,
  },
  pthumb: {
    height: 110,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  ptitle: { fontSize: 14, fontWeight: "800", color: colors.ink, lineHeight: 18 },
  pmeta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  prow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  pprice: { fontSize: 14, fontWeight: "800", color: colors.ink, flexShrink: 1, marginRight: 6 },

  cat: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  catLabel: { fontSize: 11.5, color: colors.ink, fontWeight: "600" },

  banner: {
    width: 260,
    borderRadius: radius.md,
    padding: 16,
    marginRight: 12,
    justifyContent: "center",
    minHeight: 92,
  },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  seeAll: { color: colors.carrot, fontWeight: "700", fontSize: 13 },
});
