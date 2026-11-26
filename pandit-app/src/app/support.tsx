import { router } from "expo-router";
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
  StatusIndicator,
  Txt,
  spacing,
  useColors,
  haptics,
} from "../design";

interface Ticket {
  id: string;
  ref: string;
  subject: string;
  status: string;
  created_at: string;
}

export default function Support() {
  const colors = useColors();
  const [items, setItems] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api.get<Ticket[]>("/api/v1/mp/partner/support/tickets").then(setItems).catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (subject.trim().length < 3 || body.trim().length < 3) {
      setFormError("Add a subject and a short message.");
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      const created = await api.post<Ticket>("/api/v1/mp/partner/support/tickets", {
        subject: subject.trim(),
        body: body.trim(),
      });
      setItems((prev) => [created, ...(prev ?? [])]);
      setSubject("");
      setBody("");
      haptics.success();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!items) {
    if (loadError) return <ErrorState body="Could not load your requests." onRetry={() => { setLoadError(false); load(); }} />;
    return <Loading />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <SectionHeader title="New request" />
        <FormInput label="Subject" value={subject} onChangeText={setSubject} placeholder="What's it about?" />
        <FormInput label="Message" value={body} onChangeText={setBody} placeholder="Describe the issue" multiline />
        {formError ? <View style={{ marginBottom: spacing.md }}><InlineError message={formError} /></View> : null}
        <Button label={sending ? "Sending…" : "Send request"} icon="support" onPress={submit} loading={sending} />
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="support" title="No support requests" body="Raise a request above and we'll get back to you." />
      ) : (
        items.map((t) => (
          <Card key={t.id} onPress={() => router.push(`/ticket/${t.id}`)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {t.subject}
              </Txt>
              <StatusIndicator status={t.status} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Txt variant="caption" color={colors.inkMuted}>#{t.ref}</Txt>
              <Icon name="chevron" size={14} color={colors.inkMuted} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
