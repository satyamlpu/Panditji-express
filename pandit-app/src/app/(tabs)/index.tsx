import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "../../lib/api";
import {
  ACTIVE_STATES,
  secondsLeft,
  type Booking,
  type Offer,
  type Pandit,
} from "../../lib/model";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  InlineError,
  Loading,
  PriceDisplay,
  Rating,
  
  StatusIndicator,
  TAB_BAR_SPACE,
  Txt,
  palette,
  radius,
  spacing,
  elevation,
  useColors,
  haptics,
} from "../../design";

function rupees(display: string): number {
  const n = parseInt(display.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function Dashboard() {
  const colors = useColors();
  const [me, setMe] = useState<Pandit | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [active, setActive] = useState<Booking | null>(null);
  const [all, setAll] = useState<Booking[]>([]);
  const [toggling, setToggling] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const p = await api.get<Pandit>("/api/v1/mp/partner/profile");
      if (p.status !== "approved") {
        router.replace("/onboard");
        return;
      }
      setMe(p);

      const bookings = await api.get<Booking[]>("/api/v1/mp/partner/bookings");
      setAll(bookings);
      const act = bookings.find((b) => ACTIVE_STATES.includes(b.status)) ?? null;
      setActive(act);

      if (p.availability === "online" && !act) {
        setOffers(await api.get<Offer[]>("/api/v1/mp/partner/booking-requests"));
      } else {
        setOffers([]);
        if (p.availability === "online") await api.post("/api/v1/mp/partner/heartbeat");
      }
    } catch {
      /* keep last good state; a 401 bounces to login */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    poll.current = setInterval(refresh, 3000);
    const sec = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      if (poll.current) clearInterval(poll.current);
      clearInterval(sec);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleOnline() {
    if (!me) return;
    const next = me.availability === "online" ? "offline" : "online";
    setToggling(true);
    setErr(null);
    try {
      const p = await api.patch<Pandit>("/api/v1/mp/partner/availability", { availability: next });
      setMe(p);
      haptics.success();
      refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not change availability");
    } finally {
      setToggling(false);
    }
  }

  async function respond(bookingId: string, action: "accept" | "reject") {
    setActing(bookingId + action);
    setErr(null);
    try {
      await api.post(`/api/v1/mp/partner/booking-requests/${bookingId}/${action}`);
      if (action === "accept") {
        haptics.success();
        router.push(`/job/${bookingId}`);
      }
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "That request is no longer available");
      await refresh();
    } finally {
      setActing(null);
    }
  }

  if (!me) return <Loading />;

  const online = me.availability === "online";
  const busy = me.availability === "busy" || !!active;

  // Earnings up front — real, derived from completed bookings.
  const completed = all.filter((b) => b.status === "completed");
  const total = completed.reduce((s, b) => s + rupees(b.price_display), 0);
  const now = new Date();
  const monthTotal = completed
    .filter((b) => {
      const d = new Date(b.confirmed_at ?? b.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, b) => s + rupees(b.price_display), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[palette.crimsonDeep, palette.crimson]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={["top"]}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar name={me.name} size={46} />
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={palette.goldSoft}>
                  NAMASTE
                </Txt>
                <Txt variant="h3" color={palette.white} numberOfLines={1}>
                  {me.name || "Partner"}
                </Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Icon name="location" size={12} color="rgba(234,243,236,0.8)" />
                    <Txt variant="caption" color="rgba(234,243,236,0.85)">
                      {me.city || "Kanpur"}
                    </Txt>
                  </View>
                  <Rating value={me.rating_avg} count={me.rating_count} size={13} />
                </View>
              </View>
            </View>

            {/* Earnings up front */}
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <HeaderStat label="This month" value={inr(monthTotal)} />
              <HeaderStat label="Total earned" value={inr(total)} />
              <HeaderStat label="Completed" value={String(completed.length)} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.md }}>
        {/* Availability toggle */}
        <Card
          onPress={!busy ? toggleOnline : undefined}
          style={{ borderColor: online ? colors.success : colors.border, borderWidth: 1.5 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: online ? colors.successTint : colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="power" size={22} color={online ? colors.success : colors.inkMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="h3">{busy ? "On a booking" : online ? "You're online" : "You're offline"}</Txt>
                <Txt variant="caption" color={colors.inkSecondary}>
                  {busy
                    ? "Finish your active puja to change this"
                    : online
                      ? "Receiving booking requests nearby"
                      : "Go online to start receiving requests"}
                </Txt>
              </View>
            </View>
            {!busy ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 9,
                  borderRadius: radius.pill,
                  backgroundColor: online ? colors.success : colors.primary,
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                <Txt variant="label" color="#fff">
                  {online ? "Go offline" : "Go online"}
                </Txt>
              </View>
            ) : null}
          </View>
        </Card>

        {err ? <InlineError message={err} /> : null}

        {/* Active booking */}
        {active ? (
          <Card onPress={() => router.push(`/job/${active.id}`)} style={{ borderColor: colors.accent, borderWidth: 1.5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="h3">Active puja</Txt>
              <StatusIndicator status={active.status} />
            </View>
            <Txt variant="bodyStrong" style={{ marginTop: spacing.sm }}>
              {active.service_title}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Icon name="location" size={14} color={colors.inkMuted} />
              <Txt variant="callout" color={colors.inkSecondary} style={{ flex: 1 }}>
                {active.address_line}
              </Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
              <PriceDisplay value={active.price_display} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Txt variant="label" color={colors.primary}>
                  Open job
                </Txt>
                <Icon name="forward" size={16} color={colors.primary} />
              </View>
            </View>
          </Card>
        ) : null}

        {/* Incoming requests */}
        {!active && online ? (
          <>
            <Txt variant="h3" style={{ marginTop: spacing.sm }}>
              {offers.length ? "Incoming requests" : "Waiting for requests"}
            </Txt>
            {offers.length === 0 ? (
              <EmptyState
                icon="alerts"
                title="No requests right now"
                body="You'll be notified the moment a nearby customer books a puja you offer."
              />
            ) : (
              offers.map((o) => {
                const left = secondsLeft(o.expires_at);
                const urgent = left <= 10;
                return (
                  <Card key={o.booking_id} style={{ borderColor: urgent ? colors.error : colors.border, borderWidth: urgent ? 1.5 : 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                      <Txt variant="bodyStrong" style={{ flex: 1 }}>
                        {o.service_title}
                      </Txt>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: urgent ? colors.errorTint : colors.warningTint,
                          borderRadius: radius.pill,
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                        }}
                      >
                        <Icon name="clock" size={13} color={urgent ? colors.error : colors.warning} />
                        <Txt variant="caption" color={urgent ? colors.error : colors.warning}>
                          {left}s
                        </Txt>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Icon name="location" size={14} color={colors.inkMuted} />
                      <Txt variant="callout" color={colors.inkSecondary} style={{ flex: 1 }}>
                        {o.address_line}
                        {o.landmark ? ` · Near ${o.landmark}` : ""}
                      </Txt>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm }}>
                      <PriceDisplay value={o.price_display} />
                      {o.distance_km != null ? (
                        <Txt variant="caption" color={colors.inkMuted}>
                          {o.distance_km.toFixed(1)} km away
                        </Txt>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Button label="Decline" variant="outline" loading={acting === o.booking_id + "reject"} onPress={() => respond(o.booking_id, "reject")} />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <Button label="Accept" variant="gradient" loading={acting === o.booking_id + "accept"} onPress={() => respond(o.booking_id, "accept")} />
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        ) : null}

        {/* Offline hint */}
        {!active && !online ? (
          <EmptyState
            icon="night"
            title="You're offline"
            body="Go online above to start receiving puja booking requests from customers near you."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        ...elevation.none,
      }}
    >
      <Txt variant="micro" color="rgba(234,243,236,0.8)" numberOfLines={1}>
        {label.toUpperCase()}
      </Txt>
      <Txt variant="h3" color={palette.white} numberOfLines={1} style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}
