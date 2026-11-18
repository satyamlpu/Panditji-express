import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../lib/api";
import { Button, Card, Empty, Field, Loading, StatusPill } from "../components/ui";
import { colors } from "../theme";

interface Ticket {
  id: string;
  ref: string;
  subject: string;
  status: string;
  created_at: string;
}

export default function Support() {
  const [items, setItems] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api
      .get<Ticket[]>("/api/v1/mp/customer/support/tickets")
      .then(setItems)
      .catch(() => setLoadError("Could not load your requests."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setLoadError(null);
    load();
  };

  const submit = async () => {
    if (subject.trim().length < 3 || body.trim().length < 3) {
      setFormError("Add a subject and a short message.");
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      const created = await api.post<Ticket>("/api/v1/mp/customer/support/tickets", {
        subject: subject.trim(),
        body: body.trim(),
      });
      setItems((prev) => [created, ...(prev ?? [])]);
      setSubject("");
      setBody("");
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
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
          New request
        </Text>
        <Field label="Subject" value={subject} onChangeText={setSubject} placeholder="What's it about?" />
        <Field label="Message" value={body} onChangeText={setBody} placeholder="Describe the issue" multiline />
        {formError ? <Text style={{ color: colors.tomato, marginBottom: 8 }}>{formError}</Text> : null}
        <Button label={sending ? "Sending…" : "Send request"} onPress={submit} loading={sending} />
      </Card>

      {items.length === 0 ? (
        <Empty text="No support requests yet." />
      ) : (
        items.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/ticket/${t.id}`)}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800", color: colors.ink, flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {t.subject}
                </Text>
                <StatusPill status={t.status} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>#{t.ref}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
