import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Pandit } from "../../lib/model";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  Loading,
  PressableScale,
  Rating,
  SectionHeader,
  StatusIndicator,
  TAB_BAR_SPACE,
  Txt,
  WrapRow,
  radius,
  spacing,
  useColors,
  type IconName,
} from "../../design";

export default function Profile() {
  const { signOut } = useAuth();
  const colors = useColors();
  const [me, setMe] = useState<Pandit | null>(null);

  useEffect(() => {
    api.get<Pandit>("/api/v1/mp/partner/profile").then(setMe).catch(() => {});
  }, []);

  if (!me) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <AppHeader title="Profile" />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.md }}>
        {/* Identity */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Avatar name={me.name} size={56} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Txt variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {me.name ?? "Partner"}
                </Txt>
                <StatusIndicator status={me.status} />
              </View>
              <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 2 }}>
                {me.phone}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
            <Stat label="Rating">
              <Rating value={me.rating_avg} count={me.rating_count} size={15} />
            </Stat>
            <Stat label="Reviews">
              <Txt variant="h3">{me.rating_count}</Txt>
            </Stat>
            <Stat label="Radius">
              <Txt variant="h3">{me.service_radius_km} km</Txt>
            </Stat>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="location" size={16} color={colors.primary} />
            <Txt variant="bodyStrong">{me.city ?? "—"}</Txt>
          </View>
        </Card>

        <View>
          <SectionHeader title="Languages" />
          {me.languages?.length ? (
            <WrapRow>
              {me.languages.map((l) => (
                <Chip key={l} label={l} selected />
              ))}
            </WrapRow>
          ) : (
            <Txt variant="callout" color={colors.inkSecondary}>
              No languages listed.
            </Txt>
          )}
        </View>

        <View>
          <SectionHeader title="Pujas you offer" />
          {me.capabilities.length ? (
            <View style={{ gap: spacing.sm }}>
              {me.capabilities.map((c) => (
                <Card key={c.service_id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Icon name="blessing" size={18} color={colors.primary} />
                    <Txt variant="bodyStrong">{c.title}</Txt>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Txt variant="callout" color={colors.inkSecondary}>
              No pujas selected yet.
            </Txt>
          )}
        </View>

        {/* Links */}
        <Card padded={false}>
          <LinkRow
            icon="shield"
            label={me.status === "approved" ? "Verification & KYC" : "Complete verification"}
            onPress={() => router.push("/verification")}
            first
          />
          <LinkRow icon="alerts" label="Notifications" onPress={() => router.push("/notifications")} />
          <LinkRow icon="support" label="Help & support" onPress={() => router.push("/support")} />
          {me.status !== "approved" ? (
            <LinkRow icon="forward" label="Continue onboarding" onPress={() => router.push("/onboard")} />
          ) : null}
        </Card>

        <Button
          label="Sign out"
          variant="outline"
          icon="signout"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        />
        <Txt variant="caption" color={colors.inkMuted} style={{ textAlign: "center", marginTop: spacing.sm }}>
          Pandit Ji Express · Partner app
        </Txt>
      </ScrollView>
    </View>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="micro" color={colors.inkMuted}>
        {label.toUpperCase()}
      </Txt>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

function LinkRow({ icon, label, onPress, first }: { icon: IconName; label: string; onPress: () => void; first?: boolean }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.99}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        borderRadius: radius.lg,
      }}
    >
      <Icon name={icon} size={20} color={colors.primary} />
      <Txt variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Icon name="chevron" size={18} color={colors.inkMuted} />
    </PressableScale>
  );
}
