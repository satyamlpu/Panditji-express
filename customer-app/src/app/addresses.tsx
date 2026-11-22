import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../lib/api";
import { Button, Card, Empty, Field, Loading } from "../components/ui";
import { colors } from "../theme";

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
  const [items, setItems] = useState<Address[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [line, setLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<Address[]>("/api/v1/mp/customer/addresses")
      .then(setItems)
      .catch(() => setLoadError("Could not load your addresses."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setLoadError(null);
    load();
  };

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
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save this address.");
    } finally {
      setSaving(false);
    }
  };

  if (!items) {
    if (loadError) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.muted, marginBottom: 16, textAlign: "center" }}>{loadError}</Text>
          <Button label="Retry" variant="outline" onPress={retry} />
        </View>
      );
    }
    return <Loading />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "800", fontSize: 16, color: colors.ink, marginBottom: 12 }}>
          Add an address
        </Text>
        <Field label="Label (optional)" value={label} onChangeText={setLabel} placeholder="Home, Office…" />
        <Field label="Address line" value={line} onChangeText={setLine} placeholder="House, street, area" />
        <Field label="Landmark (optional)" value={landmark} onChangeText={setLandmark} placeholder="Near…" />
        {formError ? <Text style={{ color: colors.tomato, marginBottom: 8 }}>{formError}</Text> : null}
        <Button label={saving ? "Saving…" : "Save address"} onPress={add} loading={saving} />
        <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 8 }}>
          📍 Location defaults to Kanpur centre until GPS is added.
        </Text>
      </Card>

      {items.length === 0 ? (
        <Empty text="No saved addresses yet. Add one above." />
      ) : (
        items.map((a) => (
          <Card key={a.id} style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: "800", color: colors.ink }}>{a.label ?? "Address"}</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>{a.line}</Text>
            {a.landmark ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Near {a.landmark}</Text>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
