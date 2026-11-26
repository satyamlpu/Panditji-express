import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import {
  Avatar,
  Button,
  Card,
  FormInput,
  Icon,
  InlineError,
  Loading,
  PriceDisplay,
  StarPicker,
  StatusIndicator,
  Txt,
  spacing,
  useColors,
  haptics,
} from "../../design";

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
interface BookingEvent {
  from_status: string | null; to_status: string; actor: string; reason: string | null; at: string;
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [b, setB] = useState<Booking | null>(null);
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [track, setTrack] = useState<Tracking | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Booking>(`/api/v1/mp/customer/bookings/${id}`);
      setB(data);
      try {
        setEvents(await api.get<BookingEvent[]>(`/api/v1/mp/customer/bookings/${id}/events`));
      } catch {
        /* keep last events */
      }
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
    setErr(null);
    try {
      const order = await api.post<{ provider_order_id: string }>(`/api/v1/mp/customer/bookings/${id}/pay`);
      await api.post("/api/v1/mp/payments/mock/pay", { provider_order_id: order.provider_order_id });
      setPaid(true);
      setMsg("Payment successful.");
      haptics.success();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Payment failed");
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await api.post(`/api/v1/mp/customer/bookings/${id}/review`, { rating, comment });
      setReviewed(true);
      setMsg("Thanks for your review!");
      haptics.success();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not submit review");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/v1/mp/customer/bookings/${id}/cancel`, { reason: "Changed plans" });
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  if (!b) return <Loading />;

  const dispatching = ["searching", "awaiting_acceptance"].includes(b.status);
  const assigned = ASSIGNED.includes(b.status);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {/* Summary */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
          <Txt variant="h2" style={{ flex: 1 }}>
            {b.service_title}
          </Txt>
          <StatusIndicator status={b.status} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
          <PriceDisplay value={b.price_display} size="sm" />
          <Txt variant="caption" color={colors.inkMuted}>· {b.code}</Txt>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm }}>
          <Icon name="location" size={15} color={colors.inkMuted} />
          <Txt variant="callout" color={colors.inkSecondary} style={{ flex: 1 }}>
            {b.address_line}
          </Txt>
        </View>
        {b.assigned_pandit ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Avatar name={b.assigned_pandit.name} size={40} />
            <View>
              <Txt variant="bodyStrong">{b.assigned_pandit.name ?? "Your Panditji"}</Txt>
              <Txt variant="caption" color={colors.inkSecondary}>Assigned Panditji</Txt>
            </View>
          </View>
        ) : null}
      </Card>

      {dispatching ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="search" size={18} color={colors.warning} />
            <Txt variant="bodyStrong">Finding a Panditji nearby…</Txt>
          </View>
          <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 6 }}>
            We&apos;re offering your request to the closest available Panditji.
          </Txt>
        </Card>
      ) : null}

      {b.status === "no_partner_available" ? (
        <Card style={{ borderColor: colors.error }}>
          <Txt variant="bodyStrong" color={colors.error}>No Panditji available</Txt>
          <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 4 }}>
            Please try again shortly or choose a scheduled time.
          </Txt>
        </Card>
      ) : null}

      {assigned && track ? (
        <Card style={{ borderColor: colors.primary }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="navigation" size={18} color={colors.primary} />
            <Txt variant="bodyStrong">Live tracking</Txt>
          </View>
          {track.has_location ? (
            <>
              <Txt variant="display" color={colors.primary} style={{ marginTop: spacing.sm }}>
                ~{track.eta_minutes} min
              </Txt>
              <Txt variant="caption" color={track.is_stale ? colors.error : colors.inkMuted} style={{ marginTop: 2 }}>
                {track.is_stale ? "Location may be outdated" : `Updated ${track.freshness_seconds}s ago`}
              </Txt>
            </>
          ) : (
            <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 6 }}>
              Waiting for the Panditji to share their location…
            </Txt>
          )}
        </Card>
      ) : null}

      {/* Payment */}
      {(assigned || b.status === "completed") && !paid ? (
        <Button label="Pay now" variant="gradient" icon="payments" onPress={pay} loading={busy} />
      ) : null}
      {paid ? (
        <Card style={{ borderColor: colors.success }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="checkCircle" size={18} color={colors.success} />
            <Txt variant="bodyStrong" color={colors.success}>Payment received</Txt>
          </View>
        </Card>
      ) : null}

      {/* Review */}
      {b.status === "completed" && !reviewed ? (
        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.md }}>Rate your Panditji</Txt>
          <View style={{ marginBottom: spacing.lg }}>
            <StarPicker value={rating} onChange={setRating} />
          </View>
          <FormInput label="Comment (optional)" value={comment} onChangeText={setComment} placeholder="How was it?" multiline />
          <Button label="Submit review" onPress={submitReview} loading={busy} disabled={rating === 0} />
        </Card>
      ) : null}

      {/* Cancel */}
      {(dispatching || b.status === "confirmed") ? (
        <Button label="Cancel booking" variant="outline" onPress={cancel} loading={busy} />
      ) : null}

      {/* History timeline */}
      {events.length > 0 ? (
        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.md }}>History</Txt>
          {events.map((e, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ alignItems: "center" }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4 }} />
                {i < events.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: i < events.length - 1 ? spacing.md : 0 }}>
                <Txt variant="callout" style={{ textTransform: "capitalize" }}>
                  {e.to_status.replace(/_/g, " ")}
                </Txt>
                {e.reason ? <Txt variant="caption" color={colors.inkSecondary}>{e.reason}</Txt> : null}
                <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: 1 }}>
                  {new Date(e.at).toLocaleString()}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {err ? <InlineError message={err} /> : null}
      {msg ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.sm }}>
          <Icon name="checkCircle" size={16} color={colors.success} />
          <Txt variant="callout" color={colors.success}>{msg}</Txt>
        </View>
      ) : null}
      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}
