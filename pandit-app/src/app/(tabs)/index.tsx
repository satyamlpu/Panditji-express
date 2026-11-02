import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "../../lib/api";
import {
  ACTIVE_STATES,
  secondsLeft,
  type Booking,
  type Offer,
  type Pandit,
} from "../../lib/model";
import { Button, Card, Empty, Loading, StatusPill } from "../../components/ui";
import { colors, radius, shadow } from "../../theme";

export default function Dashboard() {
  const [me, setMe] = useState<Pandit | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [active, setActive] = useState<Booking | null>(null);
  const [toggling, setToggling] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0); // drives the 1s countdown re-render
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
      const act = bookings.find((b) => ACTIVE_STATES.includes(b.status)) ?? null;
      setActive(act);

      // Only fetch offers when free and online. This call also refreshes the
      // partner's heartbeat so dispatch keeps treating the app as live.
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
    // Initial fetch, then poll. refresh() only sets state after an awaited
    // network call, so this is a legitimate subscribe-style effect.
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      {/* Forest header */}
      <View style={{ backgroundColor: colors.forest, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: colors.sunshine, fontWeight: "700", fontSize: 12 }}>Namaste 🙏</Text>
            <Text style={{ color: colors.white, fontWeight: "900", fontSize: 20 }}>{me.name || "Partner"}</Text>
            <Text style={{ color: "#cfe3d4", fontSize: 12, marginTop: 2 }}>
              {me.city || "Kanpur"} · ⭐ {me.rating_avg?.toFixed(1) ?? "New"}
              {me.rating_count ? ` (${me.rating_count})` : ""}
            </Text>
          </View>
          <View
            style={{
              width: 46, height: 46, borderRadius: 23, backgroundColor: colors.forestDark,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>🕉️</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Online toggle */}
        <Pressable
          onPress={toggleOnline}
          disabled={toggling || busy}
          style={{
            backgroundColor: online ? colors.onlineBg : colors.surface,
            borderWidth: 1.5,
            borderColor: online ? colors.online : colors.line,
            borderRadius: radius.lg,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: toggling || busy ? 0.7 : 1,
            ...shadow,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 12, height: 12, borderRadius: 6,
                backgroundColor: online ? colors.online : colors.muted, marginRight: 12,
              }}
            />
            <View>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>
                {busy ? "On a booking" : online ? "You're online" : "You're offline"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
                {busy
                  ? "Finish your active puja to change this"
                  : online
                    ? "Receiving booking requests nearby"
                    : "Go online to start receiving requests"}
              </Text>
            </View>
          </View>
          {!busy && (
            <View
              style={{
                paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill,
                backgroundColor: online ? colors.online : colors.forest,
              }}
            >
              <Text style={{ color: colors.white, fontWeight: "800", fontSize: 13 }}>
                {online ? "Go offline" : "Go online"}
              </Text>
            </View>
          )}
        </Pressable>

        {err && <Text style={{ color: colors.tomato, marginTop: 12 }}>{err}</Text>}

        {/* Active booking */}
        {active && (
          <Card style={{ marginTop: 16, borderColor: colors.carrot + "66" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>Active puja</Text>
              <StatusPill status={active.status} />
            </View>
            <Text style={{ color: colors.ink, marginTop: 8, fontWeight: "700" }}>{active.service_title}</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>📍 {active.address_line}</Text>
            <Text style={{ color: colors.ink, fontWeight: "800", marginTop: 6 }}>{active.price_display}</Text>
            <View style={{ height: 12 }} />
            <Button label="Open job →" variant="accent" onPress={() => router.push(`/job/${active.id}`)} />
          </Card>
        )}

        {/* Offers */}
        {!active && online && (
          <>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 22, marginBottom: 10 }}>
              {offers.length ? "Incoming requests" : "Waiting for requests"}
            </Text>
            {offers.length === 0 ? (
              <Empty
                icon="📡"
                title="No requests right now"
                sub="You'll be notified the moment a nearby customer books a puja you offer."
              />
            ) : (
              offers.map((o) => {
                const left = secondsLeft(o.expires_at);
                return (
                  <View
                    key={o.booking_id}
                    style={{
                      backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
                      borderColor: left <= 10 ? colors.tomato : colors.line, padding: 16, marginBottom: 12, ...shadow,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink, flex: 1 }}>
                        {o.service_title}
                      </Text>
                      <View
                        style={{
                          backgroundColor: left <= 10 ? colors.tintRose : colors.tintSaffron,
                          borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8,
                        }}
                      >
                        <Text style={{ color: left <= 10 ? colors.tomato : colors.gold, fontWeight: "800", fontSize: 12 }}>
                          ⏱ {left}s
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.muted, marginTop: 6 }}>📍 {o.address_line}</Text>
                    {o.landmark ? (
                      <Text style={{ color: colors.muted, fontSize: 12.5 }}>Near {o.landmark}</Text>
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                      <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>{o.price_display}</Text>
                      {o.distance_km != null && (
                        <Text style={{ color: colors.muted, marginLeft: 10 }}>
                          · {o.distance_km.toFixed(1)} km away
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", marginTop: 14, gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Decline"
                          variant="outline"
                          loading={acting === o.booking_id + "reject"}
                          onPress={() => respond(o.booking_id, "reject")}
                        />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <Button
                          label="Accept"
                          loading={acting === o.booking_id + "accept"}
                          onPress={() => respond(o.booking_id, "accept")}
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Offline hint */}
        {!active && !online && (
          <Empty
            icon="🌙"
            title="You're offline"
            sub="Go online above to start receiving puja booking requests from customers near you."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
