import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../../lib/api";
import { BANNERS, CATEGORIES } from "../../lib/catalog";
import {
  CategoryTile,
  GreenHeader,
  Loading,
  PromoBanner,
  PujaCard,
  SearchBar,
  SectionHeader,
} from "../../components/ui";
import { colors } from "../../theme";

interface Service {
  slug: string;
  title: string;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
}

const CAT_MATCH: Record<string, RegExp | null> = {
  all: null,
  havan: /havan|shanti|navagraha|rudra/i,
  samagri: null,
  astro: /navagraha|graha|shanti/i,
};

export default function Home() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    api.get<Service[]>("/api/v1/mp/discovery/services").then(setServices).catch(() => setServices([]));
  }, []);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Green header + search strip */}
      <View style={{ backgroundColor: colors.forest }}>
        <GreenHeader
          etaText="Pandit in 15 min"
          location="Home · Gomti Nagar, Kanpur"
          onProfile={() => router.push("/(tabs)/profile")}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <SearchBar value={q} onChangeText={setQ} />
        </View>
      </View>

      {services === null ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          {/* Promo banners */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          >
            {BANNERS.map((b) => (
              <PromoBanner key={b.key} title={b.title} sub={b.sub} bg={b.bg} fg={b.fg} />
            ))}
          </ScrollView>

          {/* Categories */}
          <View style={{ paddingLeft: 16, paddingTop: 18 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.map((c) => (
                <CategoryTile
                  key={c.key}
                  label={c.label}
                  glyph={c.glyph}
                  tint={c.tint}
                  active={cat === c.key}
                  onPress={() => setCat(c.key)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Puja grid */}
          <View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
            <SectionHeader title={q || cat !== "all" ? "Results" : "Pujas near you"} />
            {filtered.length === 0 ? (
              <Text style={{ color: colors.muted, paddingVertical: 20, textAlign: "center" }}>
                No pujas match your search.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                {filtered.map((s) => (
                  <View key={s.slug} style={{ width: "48.5%", marginBottom: 14 }}>
                    <PujaCard
                      title={s.title}
                      meta={s.duration_label}
                      price={s.price_display}
                      slug={s.slug}
                      onBook={() => router.push(`/book/${s.slug}`)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={{ textAlign: "center", color: colors.muted, fontSize: 12, marginTop: 6 }}>
            🙏 Verified pandits · Transparent pricing · Samagri on request
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
