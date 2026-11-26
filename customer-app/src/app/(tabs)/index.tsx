import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { CATEGORIES, pujaImage } from "../../lib/catalog";
import {
  Avatar,
  BookingCard,
  Chip,
  GradientButton,
  Icon,
  PanditCard,
  SearchBar,
  SectionHeader,
  ServiceCard,
  SkeletonList,
  Txt,
  Card,
  LocationSelector,
  PressableScale,
  TAB_BAR_SPACE,
  palette,
  radius,
  spacing,
  useColors,
  type IconName,
} from "../../design";

interface Service {
  slug: string;
  title: string;
  title_hi?: string | null;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
  // Centrally managed thumbnail from the Media Library (same asset as the
  // website). When absent, fall back to the bundled catalog photo / placeholder.
  thumbnail?: { url: string; thumb_url: string | null; alt: string | null } | null;
}
interface Pandit {
  id: string;
  name: string | null;
  languages: string[];
  distance_km: number;
  eta_minutes?: number | null;
  rating_avg: number | null;
  rating_count: number;
}
interface Booking {
  id: string;
  code: string;
  status: string;
  service_title: string;
  price_display: string;
}

// Demo location until GPS/geocoding is wired (labelled as a preview location).
const DEMO = { lat: 26.4499, lng: 80.3319, label: "Gomti Nagar, Kanpur" };
const ACTIVE = ["searching", "awaiting_acceptance", "confirmed", "en_route", "arrived", "in_progress"];

const CAT_MATCH: Record<string, RegExp | null> = {
  all: null,
  havan: /havan|shanti|navagraha|rudra/i,
  samagri: null,
  astro: /navagraha|graha|shanti/i,
};

export default function Home() {
  const colors = useColors();
  const [services, setServices] = useState<Service[] | null>(null);
  const [pandits, setPandits] = useState<Pandit[] | null>(null);
  const [upcoming, setUpcoming] = useState<Booking | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const gridY = useRef(0);

  const load = useCallback(async () => {
    try {
      const list = await api.get<Service[]>("/api/v1/mp/discovery/services");
      setServices(list);
      // Real nearby availability for the first/popular service at the demo point.
      if (list[0]) {
        api
          .get<Pandit[]>(
            `/api/v1/mp/discovery/pandits?service_slug=${list[0].slug}&lat=${DEMO.lat}&lng=${DEMO.lng}`,
          )
          .then(setPandits)
          .catch(() => setPandits([]));
      } else {
        setPandits([]);
      }
    } catch {
      setServices([]);
      setPandits([]);
    }
    api
      .get<Booking[]>("/api/v1/mp/customer/bookings")
      .then((b) => setUpcoming(b.find((x) => ACTIVE.includes(x.status)) ?? null))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (!services) return [];
    const needle = q.trim().toLowerCase();
    const rx = CAT_MATCH[cat];
    return services.filter((s) => {
      const hay = `${s.title} ${s.summary ?? ""}`;
      if (needle && !hay.toLowerCase().includes(needle)) return false;
      if (rx && !rx.test(hay)) return false;
      return true;
    });
  }, [services, q, cat]);

  const scrollToGrid = () =>
    scrollRef.current?.scrollTo({ y: Math.max(0, gridY.current - 12), animated: true });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Emerald header */}
      <LinearGradient colors={[palette.crimsonDeep, palette.crimson]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={["top"]}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <LocationSelector label={DEMO.label} onPress={() => router.push("/addresses")} />
              <PressableScale haptic="select" onPress={() => router.push("/(tabs)/profile")}>
                <Avatar size={40} />
              </PressableScale>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <SearchBar value={q} onChangeText={setQ} onFilter={scrollToGrid} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero */}
        <View style={{ padding: spacing.lg }}>
          <LinearGradient
            colors={[palette.crimson, palette.crimsonDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.xl, padding: spacing.xl, overflow: "hidden" }}
          >
            <Icon name="blessing" size={120} color="rgba(212,175,55,0.16)" strokeWidth={1.5} />
            <View style={{ position: "absolute", top: 0, right: -8, opacity: 0.18 }}>
              <Icon name="blessing" size={120} color={palette.gold} strokeWidth={1.2} />
            </View>
            <Txt variant="h1" color={palette.white} style={{ maxWidth: "88%" }}>
              Tradition, at your doorstep.
            </Txt>
            <Txt variant="body" color="rgba(234,243,236,0.86)" style={{ marginTop: spacing.sm, maxWidth: "92%" }}>
              Connect with verified Panditjis for your sacred moments.
            </Txt>
            <View style={{ marginTop: spacing.lg, flexDirection: "row" }}>
              <GradientButton label="Find a Panditji" icon="search" full={false} onPress={scrollToGrid} />
            </View>
          </LinearGradient>

          {/* Quick actions */}
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
            <QuickAction icon="havan" title="Book a puja" sub="Now, near you" onPress={scrollToGrid} />
            <QuickAction icon="schedule" title="Schedule" sub="Pick a time" onPress={scrollToGrid} />
          </View>
        </View>

        {/* Upcoming booking */}
        {upcoming ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            <SectionHeader title="Your upcoming booking" actionLabel="All" onAction={() => router.push("/(tabs)/bookings")} />
            <BookingCard
              title={upcoming.service_title}
              code={upcoming.code}
              price={upcoming.price_display}
              status={upcoming.status}
              onPress={() => router.push(`/booking/${upcoming.id}`)}
            />
          </View>
        ) : null}

        {/* Categories */}
        <View style={{ paddingLeft: spacing.lg, paddingTop: spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.lg }}>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} label={c.label} icon={c.icon} selected={cat === c.key} onPress={() => setCat(c.key)} />
            ))}
          </ScrollView>
        </View>

        {/* Pujas grid */}
        <View
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
          onLayout={(e) => (gridY.current = e.nativeEvent.layout.y)}
        >
          <SectionHeader title={q || cat !== "all" ? "Results" : "Popular pujas"} />
          {services === null ? (
            <SkeletonList count={4} />
          ) : filtered.length === 0 ? (
            <Card>
              <Txt variant="body" color={colors.inkSecondary} style={{ textAlign: "center" }}>
                No pujas match your search.
              </Txt>
            </Card>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {filtered.map((s) => (
                <View key={s.slug} style={{ width: "48.5%", marginBottom: spacing.md }}>
                  <ServiceCard
                    title={s.title}
                    meta={s.duration_label}
                    price={s.price_display}
                    source={s.thumbnail?.url ? { uri: s.thumbnail.url } : pujaImage(s.slug)}
                    onPress={() => router.push(`/book/${s.slug}`)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Nearby Panditjis — real discovery (live availability) */}
        {pandits && pandits.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <SectionHeader title="Panditjis available near you" />
            <View style={{ gap: spacing.md }}>
              {pandits.slice(0, 3).map((p) => (
                <PanditCard
                  key={p.id}
                  name={p.name}
                  languages={p.languages}
                  distanceKm={p.distance_km}
                  etaMinutes={p.eta_minutes}
                  ratingAvg={p.rating_avg}
                  ratingCount={p.rating_count}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Trust & safety */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <SectionHeader title="Why Pandit Ji Express" />
          <Card>
            <TrustRow icon="verified" title="Verified Panditjis" sub="Every Panditji is KYC-verified before they serve." />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
            <TrustRow icon="payments" title="Transparent pricing" sub="Clear prices up front — or 'On request' when quoted." />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
            <TrustRow icon="samagri" title="Samagri on request" sub="Optional items arranged by your Panditji." />
          </Card>
        </View>

        {/* Support */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Card onPress={() => router.push("/support")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: colors.primaryTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="support" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Need help?</Txt>
                <Txt variant="caption" color={colors.inkSecondary}>
                  Chat with our support team
                </Txt>
              </View>
              <Icon name="chevron" size={18} color={colors.inkMuted} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.primaryTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={19} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="caption" color={colors.inkSecondary} numberOfLines={1}>
          {sub}
        </Txt>
      </View>
    </PressableScale>
  );
}

function TrustRow({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Icon name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="caption" color={colors.inkSecondary}>
          {sub}
        </Txt>
      </View>
    </View>
  );
}
