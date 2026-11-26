import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import {
  Button,
  Card,
  ErrorState,
  FormInput,
  InlineError,
  Loading,
  StatusIndicator,
  Txt,
  Icon,
  spacing,
  radius,
  useColors,
} from "../../design";

interface Message {
  author: string;
  body: string;
  at: string;
}
interface TicketDetail {
  id: string;
  ref: string;
  subject: string;
  status: string;
  resolution: string | null;
  messages: Message[];
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<TicketDetail>(`/api/v1/mp/customer/support/tickets/${id}`).then(setTicket).catch(() => setLoadError(true));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (reply.trim().length < 1) return;
    setSending(true);
    setReplyError(null);
    try {
      const updated = await api.post<TicketDetail>(`/api/v1/mp/customer/support/tickets/${id}/reply`, {
        body: reply.trim(),
      });
      setTicket(updated);
      setReply("");
    } catch (e) {
      setReplyError(e instanceof ApiError ? e.message : "Could not send your reply.");
    } finally {
      setSending(false);
    }
  };

  if (!ticket) {
    if (loadError) return <ErrorState body="Could not load this request." onRetry={load} />;
    return <Loading />;
  }

  const mine = (author: string) => /you|customer/i.test(author);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Txt variant="h3" style={{ flex: 1 }}>
            {ticket.subject}
          </Txt>
          <StatusIndicator status={ticket.status} />
        </View>
        <Txt variant="caption" color={colors.inkMuted} style={{ marginTop: 4 }}>#{ticket.ref}</Txt>
        {ticket.resolution ? (
          <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.sm }}>
            <Icon name="checkCircle" size={15} color={colors.success} />
            <Txt variant="callout" color={colors.success} style={{ flex: 1 }}>
              {ticket.resolution}
            </Txt>
          </View>
        ) : null}
      </Card>

      {ticket.messages.map((m, i) => (
        <View
          key={i}
          style={{
            alignSelf: mine(m.author) ? "flex-end" : "flex-start",
            maxWidth: "88%",
            backgroundColor: mine(m.author) ? colors.primaryTint : colors.surface,
            borderWidth: 1,
            borderColor: mine(m.author) ? colors.primary : colors.border,
            borderRadius: radius.lg,
            padding: spacing.md,
          }}
        >
          <Txt variant="micro" color={colors.inkSecondary}>{m.author}</Txt>
          <Txt variant="body" style={{ marginTop: 3 }}>{m.body}</Txt>
        </View>
      ))}

      <Card>
        <FormInput label="Reply" value={reply} onChangeText={setReply} placeholder="Type your reply" multiline />
        {replyError ? <View style={{ marginBottom: spacing.md }}><InlineError message={replyError} /></View> : null}
        <Button label={sending ? "Sending…" : "Send reply"} onPress={send} loading={sending} disabled={reply.trim().length === 0} />
      </Card>
    </ScrollView>
  );
}
