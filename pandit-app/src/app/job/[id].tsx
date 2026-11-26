import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import { KANPUR, nextStep, type Booking } from "../../lib/model";
import {
  Button,
  Card,
  Icon,
  InlineError,
  Loading,
  PriceDisplay,
  StatusIndicator,
  Txt,
  radius,
  spacing,
  useColors,
  haptics,
} from "../../design";

// The lifecycle the partner advances through, shown as a step tracker.
const FLOW = [
  { status: "confirmed", label: "Confirmed" },
  { status: "en_route", label: "On the way" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "Puja in progress" },
  { status: "completed", label: "Completed" },
];

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [b, setB] = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const locTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const frac = useRef(0);

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
    frac.current = Math.min(1, frac.current + 0.25);
    const lat = KANPUR.lat + (b.dest_lat - KANPUR.lat) * frac.current;
    const lng = KANPUR.lng + (b.dest_lng - KANPUR.lng) * frac.current;
    try {
      const r = await api.post<{ eta_minutes: number }>("/api/v1/mp/partner/location", { lat, lng, accuracy_m: 20 });
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
      haptics.select();
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
      haptics.success();
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
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xxl }}>
        <Icon name="search" size={34} color={colors.inkMuted} />
        <Txt variant="h3" style={{ marginTop: spacing.md }}>
          Booking not found
        </Txt>
        <View style={{ height: spacing.lg, alignSelf: "stretch" }} />
        <Button label="Back to home" variant="outline" onPress={() => router.replace("/(tabs)")} />
      </View>
    );
  }
  if (!b) return <Loading />;

  const step = nextStep(b.status);
  const done = b.status === "completed";
  const currentIdx = FLOW.findIndex((f) => f.status === b.status);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
          <Txt variant="h2" style={{ flex: 1 }}>
            {b.service_title}
          </Txt>
          <StatusIndicator status={b.status} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
          <PriceDisplay value={b.price_display} size="sm" />
          <Txt variant="caption" color={colors.inkMuted}>· {b.code}</Txt>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Icon name="location" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{b.address_line}</Txt>
            {b.landmark ? (
              <Txt variant="caption" color={colors.inkSecondary}>
                Near {b.landmark}
              </Txt>
            ) : null}
          </View>
        </View>
      </Card>

      {/* Lifecycle tracker */}
      <Card>
        <Txt variant="label" color={colors.inkSecondary} style={{ marginBottom: spacing.md }}>
          PUJA PROGRESS
        </Txt>
        {FLOW.map((f, i) => {
          const reached = currentIdx >= i && currentIdx !== -1;
          const isCurrent = currentIdx === i;
          return (
            <View key={f.status} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: reached ? colors.primary : colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: isCurrent ? 2 : 0,
                    borderColor: colors.accent,
                  }}
                >
                  {reached ? <Icon name="check" size={13} color={colors.onPrimary} /> : null}
                </View>
                {i < FLOW.length - 1 ? (
                  <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: reached && currentIdx > i ? colors.primary : colors.border, marginVertical: 2 }} />
                ) : null}
              </View>
              <Txt
                variant={isCurrent ? "bodyStrong" : "callout"}
                color={reached ? colors.ink : colors.inkMuted}
                style={{ paddingBottom: i < FLOW.length - 1 ? spacing.md : 0, paddingTop: 1 }}
              >
                {f.label}
              </Txt>
            </View>
          );
        })}
      </Card>

      {/* Live location sharing */}
      {!done ? (
        <Card style={{ borderColor: sharing ? colors.success : colors.border, borderWidth: sharing ? 1.5 : 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="navigation" size={16} color={sharing ? colors.success : colors.inkSecondary} />
                <Txt variant="bodyStrong">{sharing ? "Sharing live location" : "Share live location"}</Txt>
              </View>
              <Txt variant="caption" color={colors.inkSecondary} style={{ marginTop: 3 }}>
                {sharing
                  ? eta != null
                    ? `Customer sees ~${eta} min ETA`
                    : "Updating the customer's tracking…"
                  : "Lets the customer track your arrival (demo position)."}
              </Txt>
            </View>
            <View style={{ width: 110 }}>
              <Button label={sharing ? "Stop" : "Start"} variant={sharing ? "danger" : "primary"} size="sm" onPress={toggleShare} />
            </View>
          </View>
        </Card>
      ) : null}

      {err ? <InlineError message={err} /> : null}

      {/* Advance / completion */}
      {step ? (
        <Button label={step.label} variant="gradient" iconRight="forward" onPress={() => advance(step.to)} loading={busy} />
      ) : done ? (
        <Card style={{ borderColor: colors.success, borderWidth: 1.5, alignItems: "center" }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.successTint, alignItems: "center", justifyContent: "center" }}>
            <Icon name="checkCircle" size={30} color={colors.success} />
          </View>
          <Txt variant="h3" style={{ marginTop: spacing.md }}>
            Puja completed
          </Txt>
          <Txt variant="callout" color={colors.inkSecondary} style={{ textAlign: "center", marginTop: 4 }}>
            Great work! The earning has been added to your account.
          </Txt>
          <View style={{ height: spacing.lg, alignSelf: "stretch" }} />
          <View style={{ alignSelf: "stretch" }}>
            <Button label="Back to home" onPress={() => router.replace("/(tabs)")} />
          </View>
        </Card>
      ) : (
        <Txt variant="callout" color={colors.inkSecondary} style={{ textAlign: "center" }}>
          This booking is {b.status.replace(/_/g, " ")}.
        </Txt>
      )}

      {!done ? (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
          <Txt variant="caption" color={colors.inkSecondary}>
            Advance each step as you go so the customer stays updated: On the way → Arrived → Puja in progress → Completed.
          </Txt>
        </View>
      ) : null}
    </ScrollView>
  );
}
