import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../../lib/api";
import { Card, Empty, Loading } from "../../components/ui";
import { colors } from "../../theme";

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export default function Notifications() {
  const [items, setItems] = useState<Notice[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .get<Notice[]>("/api/v1/mp/customer/notifications")
        .then((n) => active && setItems(n))
        .catch(() => active && setItems([]));
      api.post("/api/v1/mp/customer/notifications/read-all").catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  if (!items) return <Loading />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {items.length === 0 ? (
        <Empty text="No notifications yet." />
      ) : (
        items.map((n) => (
          <Card key={n.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {!n.read && (
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.carrot, marginRight: 8 }}
                />
              )}
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink, flex: 1 }}>
                {n.title}
              </Text>
            </View>
            {n.body ? (
              <Text style={{ color: colors.muted, marginTop: 4 }}>{n.body}</Text>
            ) : null}
            <Text style={{ color: colors.muted, marginTop: 6, fontSize: 11 }}>
              {new Date(n.created_at).toLocaleString()}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
