import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import {
  AppHeader,
  EmptyState,
  NotificationCard,
  SkeletonList,
  TAB_BAR_SPACE,
  spacing,
  useColors,
  useStatusBarStyle,
  type IconName,
} from "../../design";

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

// Map backend notification kinds to a fitting vector icon.
function iconFor(kind: string): IconName {
  if (/book|dispatch|offer|assign/i.test(kind)) return "bookings";
  if (/pay|refund|ledger/i.test(kind)) return "payments";
  if (/track|arriv|route|location/i.test(kind)) return "navigation";
  if (/review|rating/i.test(kind)) return "rating";
  return "alerts";
}

export default function Notifications() {
  const colors = useColors();
  useStatusBarStyle("dark");
  const [items, setItems] = useState<Notice[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () => api.get<Notice[]>("/api/v1/mp/customer/notifications").then(setItems).catch(() => setItems([])),
    [],
  );

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <AppHeader title="Alerts" subtitle="Booking updates & announcements" />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {items === null ? (
          <SkeletonList count={5} />
        ) : items.length === 0 ? (
          <EmptyState icon="alerts" title="You're all caught up" body="Booking offers and updates will show up here." />
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
    </View>
  );
}
