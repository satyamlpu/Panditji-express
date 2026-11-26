import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import {
  AppHeader,
  BookingCard,
  EmptyState,
  SkeletonList,
  TAB_BAR_SPACE,
  spacing,
  useColors,
  useStatusBarStyle,
} from "../../design";

interface Booking {
  id: string;
  code: string;
  status: string;
  service_title: string;
  price_display: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Bookings() {
  const colors = useColors();
  useStatusBarStyle("dark");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api.get<Booking[]>("/api/v1/mp/customer/bookings").then(setBookings).catch(() => setBookings([])), []);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <AppHeader title="Your bookings" subtitle="Track and manage your pujas" />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {bookings === null ? (
          <SkeletonList count={4} />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon="bookings"
            title="No bookings yet"
            body="Book a puja from the Home tab and it will show up here."
            actionLabel="Browse pujas"
            onAction={() => router.push("/(tabs)")}
          />
        ) : (
          bookings.map((b) => (
            <BookingCard
              key={b.id}
              title={b.service_title}
              code={b.code}
              price={b.price_display}
              status={b.status}
              meta={timeAgo(b.created_at)}
              onPress={() => router.push(`/booking/${b.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
