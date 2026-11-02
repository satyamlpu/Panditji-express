import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { KANPUR, LANGUAGES, type Pandit, type Service } from "../lib/model";
import { Button, Card, Chip, Field, Loading, SectionHeader, StatusPill, WrapRow } from "../components/ui";
import { colors } from "../theme";

export default function Onboard() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Pandit | null>(null);
  const [services, setServices] = useState<Service[]>([]);

  const [name, setName] = useState("");
  const [city, setCity] = useState("Kanpur");
  const [radius, setRadius] = useState("12");
  const [langs, setLangs] = useState<string[]>(["Hindi"]);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, svc] = await Promise.all([
          api.get<Pandit>("/api/v1/mp/partner/profile"),
          api.get<Service[]>("/api/v1/mp/discovery/services"),
        ]);
        if (p.status === "approved") {
          router.replace("/(tabs)");
          return;
        }
        setMe(p);
        setServices(svc);
        setName(p.name ?? "");
        setCity(p.city ?? "Kanpur");
        if (p.service_radius_km) setRadius(String(p.service_radius_km));
        if (p.languages?.length) setLangs(p.languages);
        if (p.capabilities?.length) setSlugs(p.capabilities.map((c) => c.slug));
      } catch {
        /* handled by 401 redirect or shown as empty */
      }
    })();
  }, []);

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function submit() {
    setError(null);
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (langs.length === 0) return setError("Select at least one language.");
    if (slugs.length === 0) return setError("Select at least one puja you can perform.");
    setBusy(true);
    try {
      const updated = await api.post<Pandit>("/api/v1/mp/partner/onboard", {
        name: name.trim(),
        languages: langs,
        city: city.trim() || null,
        base_lat: KANPUR.lat,
        base_lng: KANPUR.lng,
        service_radius_km: Number(radius) || 10,
        service_slugs: slugs,
      });
      setMe(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <Loading />;

  const pending = ["submitted", "under_review"].includes(me.status);
  const canEdit = ["draft", "action_required", "rejected"].includes(me.status);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>
            {me.name || "New partner"}
          </Text>
          <StatusPill status={me.status} />
        </View>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{me.phone}</Text>
      </Card>

      {pending && (
        <Card style={{ marginTop: 12, borderColor: colors.gold + "55" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>⏳ Verification in progress</Text>
          <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 21 }}>
            Our team is reviewing your profile and the pujas you offer. You&apos;ll be able to go online and
            receive booking requests once you&apos;re approved. This usually takes a short while.
          </Text>
          <View style={{ height: 16 }} />
          <Button label="Refresh status" variant="outline" onPress={() => router.replace("/onboard")} />
        </Card>
      )}

      {canEdit && (
        <>
          {me.status === "action_required" && (
            <Card style={{ marginTop: 12, borderColor: colors.maroon + "55" }}>
              <Text style={{ color: colors.maroon, fontWeight: "800" }}>Changes requested</Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Please review your details below and re-submit.
              </Text>
            </Card>
          )}

          <SectionHeader title="Your details" />
          <Card>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="e.g. Pandit Sharma" />
            <Field label="City" value={city} onChangeText={setCity} placeholder="Kanpur" />
            <Field
              label="Service radius (km)"
              value={radius}
              onChangeText={setRadius}
              keyboardType="number-pad"
              placeholder="12"
            />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              📍 Base location is set to a demo point in Kanpur for this preview.
            </Text>
          </Card>

          <SectionHeader title="Languages you speak" />
          <WrapRow>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} selected={langs.includes(l)} onPress={() => toggle(langs, l, setLangs)} />
            ))}
          </WrapRow>

          <SectionHeader title="Pujas you can perform" />
          <WrapRow>
            {services.map((s) => (
              <Chip
                key={s.slug}
                label={s.title}
                selected={slugs.includes(s.slug)}
                onPress={() => toggle(slugs, s.slug, setSlugs)}
              />
            ))}
          </WrapRow>

          {error && <Text style={{ color: colors.tomato, marginTop: 14 }}>{error}</Text>}

          <View style={{ height: 18 }} />
          <Button label="Submit for verification" onPress={submit} loading={busy} />
        </>
      )}

      <View style={{ height: 20 }} />
      <Button label="Sign out" variant="outline" onPress={async () => { await signOut(); router.replace("/login"); }} />
    </ScrollView>
  );
}
