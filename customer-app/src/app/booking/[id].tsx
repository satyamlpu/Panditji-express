import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import { Button, Card, Field, Loading, StatusPill } from "../../components/ui";
import { colors } from "../../theme";

const TERMINAL = ["completed", "no_partner_available", "expired", "rejected",
  "cancelled_customer", "cancelled_partner", "cancelled_platform"];
const ASSIGNED = ["confirmed", "en_route", "arrived", "in_progress"];

interface Booking {
  id: string; code: string; status: string; service_title: string;
  price_display: string; address_line: string;
  assigned_pandit: { id: string; name: string | null } | null;
}
interface Tracking {
  has_location: boolean; eta_minutes: number | null;
  freshness_seconds: number | null; is_stale: boolean; pandit_name: string | null;
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<Booking | null>(null);
  const [track, setTrack] = useState<Tracking | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Booking>(`/api/v1/mp/customer/bookings/${id}`);
      setB(data);
      if (ASSIGNED.includes(data.status)) {
        setTrack(await api.get<Tracking>(`/api/v1/mp/customer/bookings/${id}/tracking`));
      } else {
        setTrack(null);
      }
      if (TERMINAL.includes(data.status) && timer.current) clearInterval(timer.current);
    } catch {
      /* keep last state */
    }
  }, [id]);

  useEffect(() => {
    // Initial fetch on mount, then poll. refresh() sets state only after an
    // awaited network call, so this is a legitimate subscribe-style effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    timer.current = setInterval(refresh, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  async function pay() {
    setBusy(true);
    setMsg(null);
    try {
      const order = await api.post<{ provider_order_id: string }>(
        `/api/v1/mp/customer/bookings/${id}/pay`,
      );
      // Dev: simulate the gateway confirming (server verifies + posts the ledger).
      await api.post("/api/v1/mp/payments/mock/pay", {
        provider_order_id: order.provider_order_id,
      });
      setPaid(true);
      setMsg("Payment successful.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/api/v1/mp/customer/bookings/${id}/review`, { rating, comment });
      setReviewed(true);
      setMsg("Thanks for your review!");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not submit review");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.post(`/api/v1/mp/customer/bookings/${id}/cancel`, { reason: "Changed plans" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!b) return <Loading />;

  const dispatching = ["searching", "awaiting_acceptance"].includes(b.status);
  const assigned = ASSIGNED.includes(b.status);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{b.service_title}</Text>
          <StatusPill status={b.status} />
        </View>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{b.code} · {b.price_display}</Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>📍 {b.address_line}</Text>
        {b.assigned_pandit ? (
          <Text style={{ color: colors.ink, marginTop: 8, fontWeight: "600" }}>
            Pandit: {b.assigned_pandit.name ?? "Assigned"}
          </Text>
        ) : null}
      </Card>

      {dispatching && (
        <Card style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Finding a pandit nearby…</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>
            We&apos;re offering your request to the closest available pandit.
          </Text>
        </Card>
      )}

      {b.status === "no_partner_available" && (
        <Card style={{ marginBottom: 14, borderColor: colors.tomato + "55" }}>
          <Text style={{ color: colors.tomato, fontWeight: "700" }}>No pandit available</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>
            Please try again shortly or choose a scheduled time.
          </Text>
        </Card>
      )}

      {assigned && track && (
        <Card style={{ marginBottom: 14, borderColor: colors.forest + "55" }}>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Live tracking</Text>
          {track.has_location ? (
            <>
              <Text style={{ fontSize: 26, fontWeight: "800", color: colors.forest, marginTop: 6 }}>
                ~{track.eta_minutes} min
              </Text>
              <Text style={{ color: track.is_stale ? colors.tomato : colors.muted, marginTop: 2 }}>
                {track.is_stale ? "Location may be outdated" : `Updated ${track.freshness_seconds}s ago`}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Waiting for the pandit to share their location…
            </Text>
          )}
        </Card>
      )}

      {/* Actions */}
      {(assigned || b.status === "completed") && !paid && (
        <Button label="Pay now" variant="accent" onPress={pay} loading={busy} />
      )}
      {paid && (
        <Card style={{ marginBottom: 14, borderColor: colors.forest + "55" }}>
          <Text style={{ color: colors.forest, fontWeight: "700" }}>✓ Payment received</Text>
        </Card>
      )}

      {b.status === "completed" && !reviewed && (
        <Card style={{ marginTop: 14 }}>
          <Text style={{ fontWeight: "700", color: colors.ink, marginBottom: 8 }}>Rate your pandit</Text>
          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={{ fontSize: 30, marginRight: 4, color: n <= rating ? colors.sunshine : colors.line }}>
                  ★
                </Text>
              </Pressable>
            ))}
          </View>
          <Field label="Comment (optional)" value={comment} onChangeText={setComment} placeholder="How was it?" />
          <Button label="Submit review" onPress={submitReview} loading={busy} disabled={rating === 0} />
        </Card>
      )}

      {(dispatching || b.status === "confirmed") && (
        <View style={{ marginTop: 14 }}>
          <Button label="Cancel booking" variant="outline" onPress={cancel} loading={busy} />
        </View>
      )}

      {msg && <Text style={{ color: colors.forest, textAlign: "center", marginTop: 16 }}>{msg}</Text>}
    </ScrollView>
  );
}
