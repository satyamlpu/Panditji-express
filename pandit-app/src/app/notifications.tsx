import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { api } from "../lib/api";
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  NotificationCard,
  spacing,
  useColors,
  type IconName,
} from "../design";

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

function iconFor(kind: string): IconName {
  if (/book|dispatch|offer|assign|request/i.test(kind)) return "pujas";
  if (/pay|payout|ledger|earn/i.test(kind)) return "earnings";
  if (/verif|kyc|approve/i.test(kind)) return "shield";
  if (/review|rating/i.test(kind)) return "rating";
  return "alerts";
}

export default function Notifications() {
  const colors = useColors();
  const [items, setItems] = useState<Notice[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    api.get<Notice[]>("/api/v1/mp/partner/notifications").then(setItems).catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

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
    if (loadError) return <ErrorState body="Could not load notifications." onRetry={() => { setLoadError(false); load(); }} />;
    return <Loading />;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      {unread > 0 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <Button label={marking ? "Marking…" : `Mark all read (${unread})`} variant="outline" icon="check" onPress={markAll} loading={marking} />
        </View>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon="alerts" title="No notifications" body="Booking offers and updates will show up here." />
      ) : (
        items.map((n) => (
          <NotificationCard
            key={n.id}
            title={n.title}
            body={n.body}
            read={n.read}
            icon={iconFor(n.kind)}
            time={new Date(n.created_at).toLocaleString()}
          />
        ))
      )}
    </ScrollView>
  );
}
