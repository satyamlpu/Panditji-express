import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { timeAgo, type Booking } from "../../lib/model";
import {
  AppHeader,
  Card,
  EmptyState,
  Icon,
  SectionHeader,
  SkeletonList,
  TAB_BAR_SPACE,
  Txt,
  palette,
  radius,
  spacing,
  useColors,
  useStatusBarStyle,
} from "../../design";

function rupees(display: string): number {
  const n = parseInt(display.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function Earnings() {
  const colors = useColors();
  useStatusBarStyle("dark");
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

  const completed = (rows ?? []).filter((b) => b.status === "completed");
  const total = completed.reduce((s, b) => s + rupees(b.price_display), 0);
  const now = new Date();
  const thisMonth = completed.filter((b) => {
    const d = new Date(b.confirmed_at ?? b.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, b) => s + rupees(b.price_display), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <AppHeader title="Earnings" subtitle="Your puja value & payouts" />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {rows === null ? (
          <SkeletonList count={4} />
        ) : (
          <>
            {/* Headline earnings */}
            <LinearGradient colors={[palette.crimson, palette.crimsonDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.xl }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="wallet" size={16} color={palette.goldSoft} />
                <Txt variant="label" color={palette.goldSoft}>
                  Total puja value earned
                </Txt>
              </View>
              <Txt variant="display" color={palette.white} style={{ marginTop: 6 }}>
                {inr(total)}
              </Txt>
              <Txt variant="caption" color="rgba(234,243,236,0.8)" style={{ marginTop: 4 }}>
                Across {completed.length} completed {completed.length === 1 ? "puja" : "pujas"}
              </Txt>
            </LinearGradient>

            {/* Stat row */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Card style={{ flex: 1 }}>
                <Txt variant="caption" color={colors.inkSecondary}>
                  This month
                </Txt>
                <Txt variant="h2" style={{ marginTop: 4 }}>
                  {inr(monthTotal)}
                </Txt>
                <Txt variant="micro" color={colors.inkMuted} style={{ marginTop: 2 }}>
                  {thisMonth.length} PUJAS
                </Txt>
              </Card>
              <Card style={{ flex: 1 }}>
                <Txt variant="caption" color={colors.inkSecondary}>
                  Completed
                </Txt>
                <Txt variant="h2" style={{ marginTop: 4 }}>
                  {completed.length}
                </Txt>
                <Txt variant="micro" color={colors.inkMuted} style={{ marginTop: 2 }}>
                  ALL TIME
                </Txt>
              </Card>
            </View>

            <SectionHeader title="Recent completed pujas" style={{ marginTop: spacing.sm }} />
            {completed.length === 0 ? (
              <EmptyState
                icon="earnings"
                title="No earnings yet"
                body="Complete your first puja to start earning. Figures shown are gross puja value before platform fees."
              />
            ) : (
              <>
                {completed.map((b) => (
                  <Card key={b.id}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyStrong" numberOfLines={1}>
                          {b.service_title}
                        </Txt>
                        <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
                          {b.code} · {timeAgo(b.confirmed_at ?? b.created_at)}
                        </Txt>
                      </View>
                      <Txt variant="h3" color={colors.success}>
                        +{b.price_display}
                      </Txt>
                    </View>
                  </Card>
                ))}
                <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
                  Figures are gross puja value. Platform commission and payouts are settled separately by the Pandit Ji
                  Express finance team.
                </Txt>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
