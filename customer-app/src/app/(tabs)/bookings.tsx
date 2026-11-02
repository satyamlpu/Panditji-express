import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../lib/api";
import { Card, Empty, Loading, StatusPill } from "../../components/ui";
import { colors } from "../../theme";

interface Booking {
  id: string;
  code: string;
  status: string;
  service_title: string;
  price_display: string;
  created_at: string;
}

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .get<Booking[]>("/api/v1/mp/customer/bookings")
        .then((b) => active && setBookings(b))
        .catch(() => active && setBookings([]));
      return () => {
        active = false;
      };
    }, []),
  );

  if (!bookings) return <Loading />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {bookings.length === 0 ? (
        <Empty text="No bookings yet. Book a puja from the Home tab." />
      ) : (
        bookings.map((b) => (
          <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)}>
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>
                    {b.service_title}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                    {b.code} · {b.price_display}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <StatusPill status={b.status} />
                  </View>
                </View>
                <Text style={{ color: colors.carrot, fontWeight: "700" }}>›</Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
