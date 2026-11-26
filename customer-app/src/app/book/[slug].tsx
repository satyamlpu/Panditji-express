import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { api, ApiError } from "../../lib/api";
import { SAMAGRI, pujaImage } from "../../lib/catalog";
import {
  AddToggle,
  Button,
  Card,
  CatalogMedia,
  FormInput,
  Icon,
  InlineError,
  Loading,
  PanditCard,
  PriceDisplay,
  SectionHeader,
  Txt,
  elevation,
  radius,
  spacing,
  useColors,
  haptics,
} from "../../design";

// Demo location (Kanpur centre). A production app reads this from GPS/address.
const KANPUR = { lat: 26.4499, lng: 80.3319 };

interface Service {
  slug: string;
  title: string;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
  thumbnail?: { url: string; thumb_url: string | null; alt: string | null } | null;
}
interface Pandit {
  id: string;
  name: string | null;
  languages: string[];
  distance_km: number;
  rating_avg: number | null;
  rating_count: number;
}

type Mode = "immediate" | "scheduled";

function nextDays(n: number) {
  const out: { label: string; date: Date }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    out.push({ label, date: d });
  }
  return out;
}
const SLOTS = [
  { key: "morning", label: "Morning", hour: 8 },
  { key: "midday", label: "Midday", hour: 12 },
  { key: "evening", label: "Evening", hour: 18 },
];

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const [service, setService] = useState<Service | null>(null);
  const [address, setAddress] = useState("12 Civil Lines, Kanpur");
  const [samagri, setSamagri] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("immediate");
  const [dayIdx, setDayIdx] = useState(0);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pandits, setPandits] = useState<Pandit[] | null>(null);

  const days = useMemo(() => nextDays(5), []);

  useEffect(() => {
    api
      .get<Service[]>("/api/v1/mp/discovery/services")
      .then((list) => setService(list.find((s) => s.slug === slug) ?? null));
  }, [slug]);

  useEffect(() => {
    api
      .get<Pandit[]>(`/api/v1/mp/discovery/pandits?service_slug=${slug}&lat=${KANPUR.lat}&lng=${KANPUR.lng}`)
      .then(setPandits)
      .catch(() => setPandits([]));
  }, [slug]);

  function toggleSamagri(key: string) {
    haptics.select();
    setSamagri((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function scheduledAt(): string | null {
    if (mode !== "scheduled" || slotKey == null) return null;
    const slot = SLOTS.find((s) => s.key === slotKey)!;
    const d = new Date(days[dayIdx].date);
    d.setHours(slot.hour, 0, 0, 0);
    return d.toISOString();
  }

  async function book() {
    if (mode === "scheduled" && slotKey == null) {
      setError("Pick a date and time for your scheduled puja.");
      haptics.warning();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const b = await api.post<{ id: string }>("/api/v1/mp/customer/bookings", {
        service_slug: slug,
        mode,
        scheduled_at: scheduledAt(),
        address_line: address,
        lat: KANPUR.lat,
        lng: KANPUR.lng,
      });
      haptics.success();
      router.replace(`/booking/${b.id}`);
    } catch (e) {
      haptics.error();
      setError(e instanceof ApiError ? e.message : "Could not create booking");
    } finally {
      setBusy(false);
    }
  }

  if (!service) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {/* Service summary */}
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <CatalogMedia
              source={service.thumbnail?.url ? { uri: service.thumbnail.url } : pujaImage(service.slug)}
              size={68}
              icon="blessing"
            />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" numberOfLines={2}>
                {service.title}
              </Txt>
              {service.duration_label ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Icon name="clock" size={13} color={colors.inkMuted} />
                  <Txt variant="caption" color={colors.inkSecondary}>
                    {service.duration_label}
                  </Txt>
                </View>
              ) : null}
              <View style={{ marginTop: 6 }}>
                <PriceDisplay value={service.price_display} />
              </View>
            </View>
          </View>
        </Card>

        {/* Mode toggle */}
        <View style={{ flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 }}>
          {(["immediate", "scheduled"] as Mode[]).map((m) => {
            const on = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  haptics.select();
                  setMode(m);
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: radius.sm,
                  backgroundColor: on ? colors.surface : "transparent",
                  ...(on ? elevation.e1 : {}),
                }}
              >
                <Icon name={m === "immediate" ? "havan" : "schedule"} size={16} color={on ? colors.primary : colors.inkSecondary} />
                <Txt variant="label" color={on ? colors.primary : colors.inkSecondary}>
                  {m === "immediate" ? "Book now" : "Schedule"}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {mode === "immediate" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md }}>
            <Icon name="verified" size={18} color={colors.primary} />
            <Txt variant="callout" color={colors.primary} style={{ flex: 1 }}>
              We&apos;ll match the nearest available verified Panditji after you confirm.
            </Txt>
          </View>
        ) : (
          <Card>
            <Txt variant="label" color={colors.inkSecondary} style={{ marginBottom: spacing.sm }}>
              Choose a day
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {days.map((d, i) => {
                const on = dayIdx === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      haptics.select();
                      setDayIdx(i);
                    }}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.pill,
                      borderWidth: 1.5,
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primaryTint : colors.surface,
                      marginRight: spacing.sm,
                    }}
                  >
                    <Txt variant="label" color={on ? colors.primary : colors.inkSecondary}>
                      {d.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Txt variant="label" color={colors.inkSecondary} style={{ marginBottom: spacing.sm }}>
              Preferred time
            </Txt>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {SLOTS.map((s) => {
                const on = slotKey === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => {
                      haptics.select();
                      setSlotKey(s.key);
                    }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primaryTint : colors.surface,
                    }}
                  >
                    <Txt variant="label" color={on ? colors.primary : colors.inkSecondary}>
                      {s.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {/* Available Panditjis near you (real discovery) */}
        <View>
          <SectionHeader title="Available near you" />
          {pandits === null ? (
            <Card>
              <Txt variant="callout" color={colors.inkSecondary}>
                Checking who&apos;s available…
              </Txt>
            </Card>
          ) : pandits.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              {pandits.slice(0, 3).map((p) => (
                <PanditCard
                  key={p.id}
                  name={p.name}
                  languages={p.languages}
                  distanceKm={p.distance_km}
                  ratingAvg={p.rating_avg}
                  ratingCount={p.rating_count}
                />
              ))}
            </View>
          ) : (
            <Card>
              <Txt variant="callout" color={colors.inkSecondary}>
                No Panditji is online near this preview location right now — you can still place the request and
                we&apos;ll notify nearby Panditjis.
              </Txt>
            </Card>
          )}
        </View>

        {/* Samagri */}
        <View>
          <SectionHeader title="Add samagri (optional)" />
          <Txt variant="caption" color={colors.inkSecondary} style={{ marginBottom: spacing.md }}>
            Arranged by your Panditji and paid directly to them — a preference, not a charge.
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg }}>
            {SAMAGRI.map((s) => (
              <View
                key={s.key}
                style={{
                  width: 128,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginRight: spacing.md,
                  gap: 6,
                }}
              >
                <View style={{ height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                  <Image source={s.img} contentFit="contain" style={{ width: 64, height: 64 }} />
                </View>
                <Txt variant="callout" numberOfLines={1}>
                  {s.name}
                </Txt>
                <Txt variant="caption" color={colors.inkMuted} numberOfLines={1}>
                  {s.meta}
                </Txt>
                <AddToggle added={samagri.includes(s.key)} onPress={() => toggleSamagri(s.key)} />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Address */}
        <View>
          <SectionHeader title="Puja location" />
          <Card>
            <FormInput label="Address" icon="location" value={address} onChangeText={setAddress} placeholder="House / street / area" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="location" size={13} color={colors.inkMuted} />
              <Txt variant="caption" color={colors.inkMuted}>
                Using a preview location in Kanpur. No payment is taken now.
              </Txt>
            </View>
          </Card>
        </View>

        {/* Cancellation policy — transparent */}
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Icon name="shield" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Free cancellation</Txt>
              <Txt variant="caption" color={colors.inkSecondary} style={{ marginTop: 2 }}>
                Cancel any time before a Panditji is assigned at no charge. Payment is collected only after the puja.
              </Txt>
            </View>
          </View>
        </Card>

        {error ? <InlineError message={error} /> : null}
      </ScrollView>

      {/* Bottom bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={colors.inkSecondary}>
            {mode === "scheduled" ? "Scheduled puja" : "Estimated total"}
          </Txt>
          <PriceDisplay value={service.price_display} size="lg" />
        </View>
        <Button
          label={busy ? "Placing…" : mode === "scheduled" ? "Schedule puja" : "Find a Panditji"}
          variant="gradient"
          iconRight="forward"
          onPress={book}
          loading={busy}
          full={false}
          style={{ flexShrink: 0 }}
        />
      </View>
    </View>
  );
}
