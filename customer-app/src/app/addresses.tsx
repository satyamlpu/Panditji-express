import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, ApiError } from "../lib/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormInput,
  Icon,
  InlineError,
  Loading,
  SectionHeader,
  Txt,
  spacing,
  useColors,
  haptics,
} from "../design";

// The booking flow currently uses this Kanpur-centre demo coordinate; saved
// addresses reuse it until GPS / geocoding is added (a later increment).
const DEMO_COORD = { lat: 26.4499, lng: 80.3319 };

interface Address {
  id: string;
  label: string | null;
  line: string;
  landmark: string | null;
  instructions: string | null;
  lat: number;
  lng: number;
}

export default function Addresses() {
  const colors = useColors();
  const [items, setItems] = useState<Address[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState("");
  const [line, setLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<Address[]>("/api/v1/mp/customer/addresses").then(setItems).catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (line.trim().length < 3) {
      setFormError("Enter a valid address line.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await api.post<Address>("/api/v1/mp/customer/addresses", {
        label: label.trim() || null,
        line: line.trim(),
        landmark: landmark.trim() || null,
        instructions: null,
        lat: DEMO_COORD.lat,
        lng: DEMO_COORD.lng,
      });
      setItems((prev) => [...(prev ?? []), created]);
      setLabel("");
      setLine("");
      setLandmark("");
      haptics.success();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save this address.");
    } finally {
      setSaving(false);
    }
  };

  if (!items) {
    if (loadError) return <ErrorState body="Could not load your addresses." onRetry={load} />;
    return <Loading />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <SectionHeader title="Add an address" />
        <FormInput label="Label (optional)" icon="home" value={label} onChangeText={setLabel} placeholder="Home, Office…" />
        <FormInput label="Address line" icon="location" value={line} onChangeText={setLine} placeholder="House, street, area" />
        <FormInput label="Landmark (optional)" value={landmark} onChangeText={setLandmark} placeholder="Near…" />
        {formError ? <View style={{ marginBottom: spacing.md }}><InlineError message={formError} /></View> : null}
        <Button label={saving ? "Saving…" : "Save address"} onPress={add} loading={saving} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm }}>
          <Icon name="location" size={13} color={colors.inkMuted} />
          <Txt variant="caption" color={colors.inkMuted}>
            Location defaults to Kanpur centre until GPS is added.
          </Txt>
        </View>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="location" title="No saved addresses" body="Add one above to speed up your next booking." />
      ) : (
        items.map((a) => (
          <Card key={a.id}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
                <Icon name="location" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{a.label ?? "Address"}</Txt>
                <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 2 }}>
                  {a.line}
                </Txt>
                {a.landmark ? (
                  <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
                    Near {a.landmark}
                  </Txt>
                ) : null}
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
