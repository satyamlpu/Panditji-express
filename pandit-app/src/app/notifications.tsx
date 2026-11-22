import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../lib/api";
import { Button, Card, Empty, Loading } from "../components/ui";
import { colors } from "../theme";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    api
      .get<Notice[]>("/api/v1/mp/partner/notifications")
      .then(setItems)
      .catch(() => setLoadError("Could not load notifications."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setLoadError(null);
    load();
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await api.post("/api/v1/mp/partner/notifications/read-all");
      load();
    } catch {
      /* ignore — leave as-is */
    } finally {
      setMarking(false);
    }
  };

  if (!items) {
    if (loadError) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.muted, marginBottom: 16, textAlign: "center" }}>{loadError}</Text>
          <Button label="Retry" variant="outline" onPress={retry} />
        </View>
      );
    }
    return <Loading />;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {unread > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <Button
            label={marking ? "Marking…" : `Mark all read (${unread})`}
            variant="outline"
            onPress={markAll}
            loading={marking}
          />
        </View>
      ) : null}

      {items.length === 0 ? (
        <Empty icon="🔔" title="No notifications" sub="Booking offers and updates will show up here." />
      ) : (
        items.map((n) => (
          <Card key={n.id} style={{ marginBottom: 10, opacity: n.read ? 0.65 : 1 }}>
            <Text style={{ fontWeight: "800", color: colors.ink }}>{n.title}</Text>
            {n.body ? <Text style={{ color: colors.muted, marginTop: 3 }}>{n.body}</Text> : null}
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              {new Date(n.created_at).toLocaleString()}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
