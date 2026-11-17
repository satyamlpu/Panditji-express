import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Card, Field, Loading } from "../../components/ui";
import { colors } from "../../theme";

interface Me {
  id: string;
  phone: string;
  name: string | null;
  language: string | null;
}

export default function Profile() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(() => {
    api
      .get<Me>("/api/v1/mp/customer/profile")
      .then((m) => {
        setMe(m);
        setName(m.name ?? "");
        setLanguage(m.language ?? "");
      })
      .catch(() => setError("Could not load your profile."));
  }, []);
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);
  const retry = () => {
    setError(null);
    loadProfile();
  };

  if (!me) {
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.muted, marginBottom: 16, textAlign: "center" }}>{error}</Text>
          <Button label="Retry" variant="outline" onPress={retry} />
        </View>
      );
    }
    return <Loading />;
  }

  const dirty = name !== (me.name ?? "") || language !== (me.language ?? "");

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.patch<Me>("/api/v1/mp/customer/profile", {
        name: name.trim() || null,
        language: language.trim() || null,
      });
      setMe(updated);
      setName(updated.name ?? "");
      setLanguage(updated.language ?? "");
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Phone</Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 14 }}>
          {me.phone}
        </Text>

        <Field
          label="Name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setSaved(false);
          }}
          placeholder="Your name"
        />
        <Field
          label="Preferred language"
          value={language}
          onChangeText={(t) => {
            setLanguage(t);
            setSaved(false);
          }}
          placeholder="e.g. Hindi"
        />

        {error ? <Text style={{ color: colors.tomato, marginBottom: 8 }}>{error}</Text> : null}
        {saved ? <Text style={{ color: colors.forest, marginBottom: 8, fontWeight: "700" }}>Saved ✓</Text> : null}

        <Button
          label={saving ? "Saving…" : "Save changes"}
          onPress={save}
          loading={saving}
          disabled={!dirty}
        />
      </Card>

      <View style={{ marginBottom: 12 }}>
        <Button label="Saved addresses" variant="outline" onPress={() => router.push("/addresses")} />
      </View>

      <Button
        label="Sign out"
        variant="accent"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
      <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20, fontSize: 12 }}>
        Pandit Ji Express · Customer app
      </Text>
    </ScrollView>
  );
}
