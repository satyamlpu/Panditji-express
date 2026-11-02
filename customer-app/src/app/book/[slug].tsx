import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import { SAMAGRI } from "../../lib/catalog";
import { AddButton, Field, Loading, Thumb } from "../../components/ui";
import { colors, radius, shadow } from "../../theme";

// Demo location (Kanpur centre). A production app reads this from GPS/address.
const KANPUR = { lat: 26.4499, lng: 80.3319 };

interface Service {
  slug: string;
  title: string;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
}

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [address, setAddress] = useState("12 Civil Lines, Kanpur");
  const [samagri, setSamagri] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Service[]>("/api/v1/mp/discovery/services")
      .then((list) => setService(list.find((s) => s.slug === slug) ?? null));
  }, [slug]);

  function toggleSamagri(key: string) {
    setSamagri((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function book() {
    setBusy(true);
    setError(null);
    try {
      const b = await api.post<{ id: string }>("/api/v1/mp/customer/bookings", {
        service_slug: slug,
        mode: "immediate",
        address_line: address,
        lat: KANPUR.lat,
        lng: KANPUR.lng,
      });
      router.replace(`/booking/${b.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create booking");
    } finally {
      setBusy(false);
    }
  }

  if (!service) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {/* ETA strip */}
        <View style={styles.eta}>
          <Text style={{ fontSize: 20 }}>⚡</Text>
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontWeight: "800", color: colors.ink }}>Pandit in 15 minutes</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>We&apos;ll match the nearest verified pandit</Text>
          </View>
        </View>

        {/* Line item */}
        <View style={[styles.sheet, { flexDirection: "row", alignItems: "center" }]}>
          <View style={styles.thumbBox}>
            <Thumb slug={service.slug} size={64} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 15 }} numberOfLines={2}>
              {service.title}
            </Text>
            {service.duration_label ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{service.duration_label}</Text>
            ) : null}
            <Text style={{ color: colors.ink, fontWeight: "800", marginTop: 6 }}>{service.price_display}</Text>
          </View>
          <View style={styles.qtyTag}>
            <Text style={{ color: colors.forest, fontWeight: "800", fontSize: 13 }}>×1</Text>
          </View>
        </View>

        {/* Before you book — samagri add-ons */}
        <Text style={styles.secTitle}>Before you book</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
          Optional samagri — arranged by your pandit and paid directly to them.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
          {SAMAGRI.map((s) => (
            <View key={s.key} style={styles.addon}>
              <View style={styles.addonThumb}>
                <Image source={s.img} resizeMode="contain" style={{ width: 70, height: 70 }} />
              </View>
              <Text style={{ fontWeight: "700", color: colors.ink, fontSize: 12.5 }} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }} numberOfLines={1}>
                {s.meta}
              </Text>
              <AddButton
                label="Add"
                added={samagri.includes(s.key)}
                onPress={() => toggleSamagri(s.key)}
              />
            </View>
          ))}
        </ScrollView>

        {/* Address */}
        <Text style={styles.secTitle}>Performing the puja at</Text>
        <View style={styles.sheet}>
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="House / street / area" />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            📍 Using a demo location in Kanpur. No payment is taken now.
          </Text>
        </View>

        {/* Coupon strip (cosmetic) */}
        <View style={styles.coupon}>
          <Text style={{ fontSize: 16 }}>🎟️</Text>
          <Text style={{ color: colors.forest, fontWeight: "700", marginLeft: 10, flex: 1 }}>
            10% OFF on your first puja is auto-applied
          </Text>
        </View>

        {error && <Text style={{ color: colors.tomato, marginTop: 14, textAlign: "center" }}>{error}</Text>}
      </ScrollView>

      {/* Bottom place-booking bar */}
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Total</Text>
          <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 18 }}>{service.price_display}</Text>
        </View>
        <Pressable
          onPress={book}
          disabled={busy}
          style={({ pressed }) => [styles.placeBtn, { opacity: busy ? 0.6 : pressed ? 0.9 : 1 }]}
        >
          <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>
            {busy ? "Finding pandit…" : "Find a pandit now  →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  eta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tintGreen,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 6,
    ...shadow,
  },
  thumbBox: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  qtyTag: {
    backgroundColor: colors.tintGreen,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 20, marginBottom: 4 },
  addon: {
    width: 118,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    marginRight: 10,
    ...shadow,
  },
  addonThumb: {
    height: 74,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  coupon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tintGreen,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.addBorder + "33",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  placeBtn: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
} as const;
