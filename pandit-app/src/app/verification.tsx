import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../lib/api";
import { Button, Card, Chip, Field, Loading, StatusPill, WrapRow } from "../components/ui";
import { colors } from "../theme";

interface Doc {
  id: string;
  doc_type: string;
  reference: string | null;
  status: string;
  decision_reason: string | null;
  created_at: string;
}
interface Verification {
  status: string;
  documents: Doc[];
}

const DOC_TYPES = [
  { key: "id_proof", label: "ID proof" },
  { key: "address_proof", label: "Address proof" },
  { key: "experience_cert", label: "Experience" },
  { key: "photo", label: "Photo" },
];

export default function VerificationScreen() {
  const [data, setData] = useState<Verification | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docType, setDocType] = useState("id_proof");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Verification>("/api/v1/mp/partner/verification")
      .then(setData)
      .catch(() => setLoadError("Could not load your verification."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setLoadError(null);
    load();
  };

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/api/v1/mp/partner/verification/documents", {
        doc_type: docType,
        reference: reference.trim() || null,
      });
      setReference("");
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) {
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

  const approved = data.status === "approved";

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: colors.ink }}>Verification status</Text>
          <StatusPill status={data.status} />
        </View>
        {approved ? (
          <Text style={{ color: colors.forest, marginTop: 8 }}>
            ✓ You&apos;re verified — go online and accept bookings.
          </Text>
        ) : (
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            Submit your KYC documents below. Our team will review and approve your account.
          </Text>
        )}
      </Card>

      {!approved ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={{ fontWeight: "800", fontSize: 15, color: colors.ink, marginBottom: 4 }}>
            Submit a document
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
            Pick a type and add a short reference — never the full ID number.
          </Text>
          <WrapRow>
            {DOC_TYPES.map((t) => (
              <Chip key={t.key} label={t.label} selected={docType === t.key} onPress={() => setDocType(t.key)} />
            ))}
          </WrapRow>
          <Field
            label="Reference (optional)"
            value={reference}
            onChangeText={setReference}
            placeholder="e.g. Aadhaar — last 4: 1234"
          />
          {formError ? <Text style={{ color: colors.tomato, marginBottom: 8 }}>{formError}</Text> : null}
          <Button label={submitting ? "Submitting…" : "Submit document"} onPress={submit} loading={submitting} />
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
            Photo/scan upload is coming soon — for now this records the document for review.
          </Text>
        </Card>
      ) : null}

      <Text style={{ fontWeight: "800", fontSize: 15, color: colors.ink, marginTop: 20, marginBottom: 8 }}>
        Submitted documents
      </Text>
      {data.documents.length === 0 ? (
        <Text style={{ color: colors.muted }}>Nothing submitted yet.</Text>
      ) : (
        data.documents.map((d) => (
          <Card key={d.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "800", color: colors.ink, textTransform: "capitalize" }}>
                {d.doc_type.replace(/_/g, " ")}
              </Text>
              <StatusPill status={d.status} />
            </View>
            {d.reference ? <Text style={{ color: colors.muted, marginTop: 2 }}>{d.reference}</Text> : null}
            {d.decision_reason ? (
              <Text style={{ color: colors.tomato, fontSize: 12, marginTop: 2 }}>{d.decision_reason}</Text>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
