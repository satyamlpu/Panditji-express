/**
 * Domain cards: CatalogMedia (image + designed placeholder), ServiceCard,
 * PanditCard, BookingCard, NotificationCard. App-agnostic: media sources and
 * routing are passed in as props. Shared design system — mirrored into both apps.
 */
import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageSource, type ImageStyle } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { palette, radius, spacing } from "../tokens";
import { useColors } from "../theme";
import { Icon, type IconName } from "../icons";
import { Txt, Card } from "./primitives";
import { PriceDisplay, Rating, StatusIndicator, VerifiedBadge, Avatar } from "./display";

/** Image with a designed neutral placeholder (never an emoji) when media is missing. */
export function CatalogMedia({
  source,
  size,
  height,
  icon = "blessing",
  radius: r = radius.md,
  style,
}: {
  source?: ImageSource | number | null;
  size?: number;
  height?: number;
  icon?: IconName;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const dims: ViewStyle = size ? { width: size, height: size } : { width: "100%", height: height ?? 120 };
  if (source) {
    const imageStyle = [dims, { borderRadius: r, backgroundColor: colors.surfaceAlt }, style] as unknown as ImageStyle;
    return <Image source={source} contentFit="cover" transition={180} style={imageStyle} />;
  }
  return (
    <LinearGradient
      colors={[palette.emeraldTint, palette.goldTint]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[dims, { borderRadius: r, alignItems: "center", justifyContent: "center" }, style]}
    >
      <Icon name={icon} size={size ? size * 0.4 : 34} color={colors.primary} />
    </LinearGradient>
  );
}

export function ServiceCard({
  title,
  meta,
  price,
  source,
  onPress,
  right,
}: {
  title: string;
  meta?: string | null;
  price: string;
  source?: ImageSource | number | null;
  onPress: () => void;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Card onPress={onPress} padded={false} style={{ overflow: "hidden" }}>
      <CatalogMedia source={source} height={116} radius={0} />
      <View style={{ padding: spacing.md, gap: 2 }}>
        <Txt variant="bodyStrong" numberOfLines={2} style={{ minHeight: 40 }}>
          {title}
        </Txt>
        {meta ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="clock" size={12} color={colors.inkMuted} />
            <Txt variant="caption" color={colors.inkSecondary} numberOfLines={1}>
              {meta}
            </Txt>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm }}>
          <PriceDisplay value={price} />
          {right ?? <Icon name="forward" size={18} color={colors.primary} />}
        </View>
      </View>
    </Card>
  );
}

export function PanditCard({
  name,
  languages,
  distanceKm,
  etaMinutes,
  ratingAvg,
  ratingCount,
  onPress,
  selected,
}: {
  name?: string | null;
  languages?: string[] | null;
  distanceKm?: number | null;
  /** Indicative ETA from the discovery endpoint (straight-line estimate); shown only when present. */
  etaMinutes?: number | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  onPress?: () => void;
  selected?: boolean;
}) {
  const colors = useColors();
  const langs = (languages ?? []).filter(Boolean);
  return (
    <Card onPress={onPress} style={selected ? { borderColor: colors.primary, borderWidth: 1.5 } : undefined}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <Avatar name={name} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Txt variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {name ?? "Verified Panditji"}
            </Txt>
            <VerifiedBadge size="sm" />
          </View>
          <Rating value={ratingAvg} count={ratingCount} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" }}>
            {distanceKm != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Icon name="location" size={12} color={colors.inkMuted} />
                <Txt variant="caption" color={colors.inkSecondary}>
                  {distanceKm.toFixed(1)} km away
                </Txt>
              </View>
            ) : null}
            {etaMinutes != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Icon name="clock" size={12} color={colors.inkMuted} />
                <Txt variant="caption" color={colors.inkSecondary}>
                  ~{etaMinutes} min away
                </Txt>
              </View>
            ) : null}
            {langs.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Icon name="language" size={12} color={colors.inkMuted} />
                <Txt variant="caption" color={colors.inkSecondary} numberOfLines={1}>
                  {langs.join(" · ")}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
        {onPress ? <Icon name="chevron" size={18} color={colors.inkMuted} /> : null}
      </View>
    </Card>
  );
}

export function BookingCard({
  title,
  code,
  price,
  status,
  meta,
  onPress,
}: {
  title: string;
  code?: string;
  price: string;
  status: string;
  meta?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {title}
          </Txt>
          <StatusIndicator status={status} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <PriceDisplay value={price} size="sm" />
            {code ? (
              <Txt variant="caption" color={colors.inkMuted}>
                · {code}
              </Txt>
            ) : null}
            {meta ? (
              <Txt variant="caption" color={colors.inkMuted}>
                · {meta}
              </Txt>
            ) : null}
          </View>
        </View>
        {onPress ? <Icon name="chevron" size={18} color={colors.inkMuted} /> : null}
      </View>
    </Card>
  );
}

export function NotificationCard({
  title,
  body,
  time,
  read,
  icon = "alerts",
  onPress,
}: {
  title: string;
  body?: string | null;
  time?: string;
  read?: boolean;
  icon?: IconName;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Card onPress={onPress} elevated={!read} style={{ opacity: read ? 0.72 : 1 }}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: read ? colors.surfaceAlt : colors.primaryTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={18} color={read ? colors.inkMuted : colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </Txt>
            {!read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
          </View>
          {body ? (
            <Txt variant="callout" color={colors.inkSecondary}>
              {body}
            </Txt>
          ) : null}
          {time ? (
            <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
              {time}
            </Txt>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
