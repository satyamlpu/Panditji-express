import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../../lib/api";
import { Button, Card, Field, Loading, StatusPill } from "../../components/ui";
import { colors } from "../../theme";

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
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<TicketDetail>(`/api/v1/mp/partner/support/tickets/${id}`)
      .then(setTicket)
      .catch(() => setLoadError("Could not load this request."));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setLoadError(null);
    load();
  };

  const send = async () => {
    if (reply.trim().length < 1) return;
    setSending(true);
    setReplyError(null);
    try {
      const updated = await api.post<TicketDetail>(
        `/api/v1/mp/partner/support/tickets/${id}/reply`,
        { body: reply.trim() },
      );
      setTicket(updated);
      setReply("");
    } catch (e) {
      setReplyError(e instanceof ApiError ? e.message : "Could not send your reply.");
    } finally {
      setSending(false);
    }
  };

  if (!ticket) {
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "800", fontSize: 16, color: colors.ink, flex: 1, marginRight: 8 }}>
            {ticket.subject}
          </Text>
          <StatusPill status={ticket.status} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>#{ticket.ref}</Text>
        {ticket.resolution ? (
          <Text style={{ color: colors.forest, marginTop: 8 }}>Resolution: {ticket.resolution}</Text>
        ) : null}
      </Card>

      {ticket.messages.map((m, i) => (
        <Card key={i} style={{ marginBottom: 8 }}>
          <Text style={{ fontWeight: "700", color: colors.ink, fontSize: 12 }}>{m.author}</Text>
          <Text style={{ color: colors.ink, marginTop: 3 }}>{m.body}</Text>
        </Card>
      ))}

      <Card style={{ marginTop: 8 }}>
        <Field label="Reply" value={reply} onChangeText={setReply} placeholder="Type your reply" multiline />
        {replyError ? <Text style={{ color: colors.tomato, marginBottom: 8 }}>{replyError}</Text> : null}
        <Button
          label={sending ? "Sending…" : "Send reply"}
          onPress={send}
          loading={sending}
          disabled={reply.trim().length === 0}
        />
      </Card>
    </ScrollView>
  );
}
