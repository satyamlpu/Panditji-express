import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { KANPUR, LANGUAGES, type Pandit, type Service } from "../lib/model";
import {
  Button,
  Card,
  Chip,
  FormInput,
  Icon,
  InlineError,
  Loading,
  SectionHeader,
  StatusIndicator,
  Txt,
  WrapRow,
  spacing,
  useColors,
  haptics,
} from "../design";

export default function Onboard() {
  const { signOut } = useAuth();
  const colors = useColors();
  const [me, setMe] = useState<Pandit | null>(null);
  const [services, setServices] = useState<Service[]>([]);

  const [name, setName] = useState("");
  const [city, setCity] = useState("Kanpur");
  const [radiusKm, setRadiusKm] = useState("12");
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
        if (p.service_radius_km) setRadiusKm(String(p.service_radius_km));
        if (p.languages?.length) setLangs(p.languages);
        if (p.capabilities?.length) setSlugs(p.capabilities.map((c) => c.slug));
      } catch {
        /* handled by 401 redirect or shown as empty */
      }
    })();
  }, []);

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
    haptics.select();
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
        service_radius_km: Number(radiusKm) || 10,
        service_slugs: slugs,
      });
      setMe(updated);
      haptics.success();
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
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Txt variant="h3" style={{ flex: 1 }}>
            {me.name || "New partner"}
          </Txt>
          <StatusIndicator status={me.status} />
        </View>
        <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 4 }}>
          {me.phone}
        </Txt>
      </Card>

      {pending ? (
        <Card style={{ borderColor: colors.warning, borderWidth: 1.5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="clock" size={18} color={colors.warning} />
            <Txt variant="h3">Verification in progress</Txt>
          </View>
          <Txt variant="body" color={colors.inkSecondary} style={{ marginTop: spacing.sm }}>
            Our team is reviewing your profile and the pujas you offer. You&apos;ll be able to go online and receive
            booking requests once you&apos;re approved. This usually takes a short while.
          </Txt>
          <View style={{ height: spacing.lg }} />
          <Button label="Refresh status" icon="refresh" variant="outline" onPress={() => router.replace("/onboard")} />
        </Card>
      ) : null}

      {canEdit ? (
        <>
          {me.status === "action_required" ? (
            <Card style={{ borderColor: colors.error, borderWidth: 1.5 }}>
              <Txt variant="bodyStrong" color={colors.error}>
                Changes requested
              </Txt>
              <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 4 }}>
                Please review your details below and re-submit.
              </Txt>
            </Card>
          ) : null}

          <SectionHeader title="Your details" style={{ marginTop: spacing.sm }} />
          <Card>
            <FormInput label="Full name" icon="profile" value={name} onChangeText={setName} placeholder="e.g. Panditji Sharma" />
            <FormInput label="City" icon="location" value={city} onChangeText={setCity} placeholder="Kanpur" />
            <FormInput label="Service radius (km)" icon="navigation" value={radiusKm} onChangeText={setRadiusKm} keyboardType="number-pad" placeholder="12" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="location" size={13} color={colors.inkMuted} />
              <Txt variant="caption" color={colors.inkMuted}>
                Base location is a preview point in Kanpur for now.
              </Txt>
            </View>
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
              <Chip key={s.slug} label={s.title} selected={slugs.includes(s.slug)} onPress={() => toggle(slugs, s.slug, setSlugs)} />
            ))}
          </WrapRow>

          {error ? <InlineError message={error} /> : null}

          <View style={{ height: spacing.xs }} />
          <Button label="Submit for verification" onPress={submit} loading={busy} />
        </>
      ) : null}

      <View style={{ height: spacing.sm }} />
      <Button
        label="Sign out"
        variant="ghost"
        icon="signout"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
    </ScrollView>
  );
}
