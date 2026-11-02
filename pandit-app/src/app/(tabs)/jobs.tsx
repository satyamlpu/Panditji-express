import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../lib/api";
import { ACTIVE_STATES, timeAgo, type Booking } from "../../lib/model";
import { Card, Empty, Loading, StatusPill } from "../../components/ui";
import { colors } from "../../theme";

export default function Jobs() {
  const [rows, setRows] = useState<Booking[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      api
        .get<Booking[]>("/api/v1/mp/partner/bookings")
        .then((r) => on && setRows(r))
        .catch(() => on && setRows([]));
      return () => {
        on = false;
      };
    }, []),
  );

  if (!rows) return <Loading />;

  if (rows.length === 0) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}>
        <Empty
          icon="📿"
          title="No pujas yet"
          sub="Accepted booking requests will appear here. Go online from the Home tab to start receiving them."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      {rows.map((b) => {
        const active = ACTIVE_STATES.includes(b.status);
        return (
          <Pressable key={b.id} onPress={() => active && router.push(`/job/${b.id}`)} disabled={!active}>
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, flex: 1 }}>
                  {b.service_title}
                </Text>
                <StatusPill status={b.status} />
              </View>
              <Text style={{ color: colors.muted, marginTop: 6 }}>📍 {b.address_line}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: colors.ink, fontWeight: "800" }}>{b.price_display}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {b.code} · {timeAgo(b.created_at)}
                </Text>
              </View>
              {active && (
                <Text style={{ color: colors.carrot, fontWeight: "700", marginTop: 8, fontSize: 13 }}>
                  Tap to manage →
                </Text>
              )}
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
