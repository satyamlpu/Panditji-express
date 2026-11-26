import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { ACTIVE_STATES, timeAgo, type Booking } from "../../lib/model";
import {
  AppHeader,
  BookingCard,
  EmptyState,
  Icon,
  SkeletonList,
  TAB_BAR_SPACE,
  Txt,
  spacing,
  useColors,
} from "../../design";

export default function Jobs() {
  const colors = useColors();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () => api.get<Booking[]>("/api/v1/mp/partner/bookings").then(setRows).catch(() => setRows([])),
    [],
  );

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <AppHeader title="My pujas" subtitle="Your accepted and past bookings" />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {rows === null ? (
          <SkeletonList count={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="pujas"
            title="No pujas yet"
            body="Accepted booking requests appear here. Go online from the Home tab to start receiving them."
          />
        ) : (
          rows.map((b) => {
            const active = ACTIVE_STATES.includes(b.status);
            return (
              <View key={b.id}>
                <BookingCard
                  title={b.service_title}
                  code={b.code}
                  price={b.price_display}
                  status={b.status}
                  meta={timeAgo(b.created_at)}
                  onPress={active ? () => router.push(`/job/${b.id}`) : undefined}
                />
                {active ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, marginLeft: spacing.xs }}>
                    <Icon name="navigation" size={13} color={colors.primary} />
                    <Txt variant="caption" color={colors.primary}>
                      Tap to manage this puja
                    </Txt>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
