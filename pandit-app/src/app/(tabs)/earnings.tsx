import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../../lib/api";
import { timeAgo, type Booking } from "../../lib/model";
import { Card, Empty, Loading } from "../../components/ui";
import { colors, radius, shadow } from "../../theme";

// price_display looks like "₹1,500" — pull the rupee amount back out.
function rupees(display: string): number {
  const n = parseInt(display.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function Earnings() {
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

  const completed = rows.filter((b) => b.status === "completed");
  const total = completed.reduce((s, b) => s + rupees(b.price_display), 0);
  const now = new Date();
  const thisMonth = completed.filter((b) => {
    const d = new Date(b.confirmed_at ?? b.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, b) => s + rupees(b.price_display), 0);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      {/* Headline earnings card */}
      <View
        style={{
          backgroundColor: colors.forest, borderRadius: radius.lg, padding: 20, ...shadow,
        }}
      >
        <Text style={{ color: colors.sunshine, fontWeight: "700", fontSize: 13 }}>Total puja value earned</Text>
        <Text style={{ color: colors.white, fontWeight: "900", fontSize: 36, marginTop: 4 }}>{inr(total)}</Text>
        <Text style={{ color: "#cfe3d4", fontSize: 12.5, marginTop: 4 }}>
          Across {completed.length} completed {completed.length === 1 ? "puja" : "pujas"}
        </Text>
      </View>

      {/* Stat row */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>This month</Text>
            <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 20, marginTop: 4 }}>{inr(monthTotal)}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{thisMonth.length} pujas</Text>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Completed</Text>
            <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 20, marginTop: 4 }}>{completed.length}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>all time</Text>
          </Card>
        </View>
      </View>

      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 22, marginBottom: 10 }}>
        Recent completed pujas
      </Text>

      {completed.length === 0 ? (
        <Empty
          icon="💰"
          title="No earnings yet"
          sub="Complete your first puja to start earning. Figures shown are gross puja value before platform fees."
        />
      ) : (
        <>
          {completed.map((b) => (
            <Card key={b.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", color: colors.ink }}>{b.service_title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {b.code} · {timeAgo(b.confirmed_at ?? b.created_at)}
                  </Text>
                </View>
                <Text style={{ color: colors.online, fontWeight: "900", fontSize: 16 }}>
                  +{b.price_display}
                </Text>
              </View>
            </Card>
          ))}
          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 8, lineHeight: 17 }}>
            Figures are gross puja value. Platform commission and payouts are settled separately by the Pandit Ji
            Express finance team.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
