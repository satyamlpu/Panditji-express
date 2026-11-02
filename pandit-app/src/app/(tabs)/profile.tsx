import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Pandit } from "../../lib/model";
import { Button, Card, Chip, Loading, SectionHeader, StatusPill, WrapRow } from "../../components/ui";
import { colors } from "../../theme";

export default function Profile() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Pandit | null>(null);

  useEffect(() => {
    api.get<Pandit>("/api/v1/mp/partner/profile").then(setMe).catch(() => {});
  }, []);

  if (!me) return <Loading />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.ink }}>{me.name ?? "Partner"}</Text>
          <StatusPill status={me.status} />
        </View>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{me.phone}</Text>
        <View style={{ flexDirection: "row", marginTop: 12, gap: 20 }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>RATING</Text>
            <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16, marginTop: 2 }}>
              ⭐ {me.rating_avg?.toFixed(1) ?? "New"}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>REVIEWS</Text>
            <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16, marginTop: 2 }}>{me.rating_count}</Text>
          </View>
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>RADIUS</Text>
            <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16, marginTop: 2 }}>
              {me.service_radius_km} km
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader title="City" />
      <Card>
        <Text style={{ color: colors.ink }}>📍 {me.city ?? "—"}</Text>
      </Card>

      <SectionHeader title="Languages" />
      {me.languages?.length ? (
        <WrapRow>
          {me.languages.map((l) => (
            <Chip key={l} label={l} selected />
          ))}
        </WrapRow>
      ) : (
        <Text style={{ color: colors.muted }}>No languages listed.</Text>
      )}

      <SectionHeader title="Pujas you offer" />
      {me.capabilities.length ? (
        me.capabilities.map((c) => (
          <Card key={c.service_id} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: "700", color: colors.ink }}>🕉️  {c.title}</Text>
          </Card>
        ))
      ) : (
        <Text style={{ color: colors.muted }}>No pujas selected yet.</Text>
      )}

      <View style={{ height: 16 }} />
      {me.status !== "approved" && (
        <>
          <Button label="Continue onboarding" variant="outline" onPress={() => router.push("/onboard")} />
          <View style={{ height: 10 }} />
        </>
      )}
      <Button
        label="Sign out"
        variant="outline"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
      <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20, fontSize: 12 }}>
        Pandit Ji Express · Partner app
      </Text>
    </ScrollView>
  );
}
