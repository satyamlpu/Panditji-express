import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import { KANPUR, nextStep, type Booking } from "../../lib/model";
import { Button, Card, Loading, StatusPill } from "../../components/ui";
import { colors, radius } from "../../theme";

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const locTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const frac = useRef(0); // demo: how far along base→destination we've "travelled"

  const refresh = useCallback(async () => {
    try {
      const rows = await api.get<Booking[]>("/api/v1/mp/partner/bookings");
      const found = rows.find((x) => x.id === id) ?? null;
      if (!found) setNotFound(true);
      else setB(found);
    } catch {
      /* keep last state */
    }
  }, [id]);

  useEffect(() => {
    // Initial fetch, then poll. refresh() only sets state after an awaited
    // network call, so this is a legitimate subscribe-style effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    poll.current = setInterval(refresh, 4000);
    return () => {
      if (poll.current) clearInterval(poll.current);
      if (locTimer.current) clearInterval(locTimer.current);
    };
  }, [refresh]);

  const pingLocation = useCallback(async () => {
    if (!b) return;
    // Demo: move a quarter of the remaining way from the Kanpur base toward the
    // customer each ping, so the customer's live ETA visibly counts down.
    frac.current = Math.min(1, frac.current + 0.25);
    const lat = KANPUR.lat + (b.dest_lat - KANPUR.lat) * frac.current;
    const lng = KANPUR.lng + (b.dest_lng - KANPUR.lng) * frac.current;
    try {
      const r = await api.post<{ eta_minutes: number }>("/api/v1/mp/partner/location", {
        lat,
        lng,
        accuracy_m: 20,
      });
      setEta(r.eta_minutes);
    } catch {
      /* location only allowed while active; ignore otherwise */
    }
  }, [b]);

  function toggleShare() {
    if (sharing) {
      if (locTimer.current) clearInterval(locTimer.current);
      locTimer.current = null;
      setSharing(false);
    } else {
      setSharing(true);
      pingLocation();
      locTimer.current = setInterval(pingLocation, 5000);
    }
  }

  async function advance(to: string) {
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.post<Booking>(`/api/v1/mp/partner/bookings/${id}/status`, { to_status: to });
      setB(updated);
      if (to === "completed" && locTimer.current) {
        clearInterval(locTimer.current);
        locTimer.current = null;
        setSharing(false);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
        <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>Booking not found</Text>
        <View style={{ height: 16 }} />
        <Button label="Back to home" variant="outline" onPress={() => router.replace("/(tabs)")} />
      </View>
    );
  }
  if (!b) return <Loading />;

  const step = nextStep(b.status);
  const done = b.status === "completed";

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 19, fontWeight: "800", color: colors.ink }}>{b.service_title}</Text>
          <StatusPill status={b.status} />
        </View>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{b.code} · {b.price_display}</Text>
        <View style={{ height: 12 }} />
        <Text style={{ color: colors.ink, fontWeight: "700" }}>📍 {b.address_line}</Text>
        {b.landmark ? <Text style={{ color: colors.muted, marginTop: 2 }}>Near {b.landmark}</Text> : null}
      </Card>

      {/* Live location sharing (available while active) */}
      {!done && (
        <Card style={{ marginTop: 14, borderColor: sharing ? colors.online + "66" : colors.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: "800", color: colors.ink }}>
                {sharing ? "Sharing live location" : "Share live location"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 3 }}>
                {sharing
                  ? eta != null
                    ? `Customer sees ~${eta} min ETA`
                    : "Updating the customer's tracking…"
                  : "Lets the customer track your arrival (demo position)."}
              </Text>
            </View>
            <View style={{ width: 118 }}>
              <Button
                label={sharing ? "Stop" : "Start"}
                variant={sharing ? "danger" : "primary"}
                onPress={toggleShare}
              />
            </View>
          </View>
        </Card>
      )}

      {err && <Text style={{ color: colors.tomato, marginTop: 14, textAlign: "center" }}>{err}</Text>}

      {/* Advance / completion */}
      <View style={{ marginTop: 18 }}>
        {step ? (
          <Button label={step.label} variant="accent" onPress={() => advance(step.to)} loading={busy} />
        ) : done ? (
          <Card style={{ borderColor: colors.online + "66", alignItems: "center" }}>
            <Text style={{ fontSize: 34 }}>✅</Text>
            <Text style={{ fontWeight: "800", color: colors.ink, marginTop: 6, fontSize: 16 }}>Puja completed</Text>
            <Text style={{ color: colors.muted, marginTop: 4, textAlign: "center" }}>
              Great work! The earning has been added to your account.
            </Text>
            <View style={{ height: 14 }} />
            <View style={{ alignSelf: "stretch" }}>
              <Button label="Back to home" onPress={() => router.replace("/(tabs)")} />
            </View>
          </Card>
        ) : (
          <Text style={{ color: colors.muted, textAlign: "center" }}>This booking is {b.status}.</Text>
        )}
      </View>

      {/* Step hint */}
      {!done && (
        <View style={{ marginTop: 20, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 19 }}>
            Flow: Confirmed → On the way → Arrived → Puja in progress → Completed. Advance each step as you go so
            the customer stays updated.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
