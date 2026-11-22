import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../lib/api";
import { Button, Card, Chip, Field, Loading, StatusPill, WrapRow } from "../components/ui";
import { colors } from "../theme";

interface Doc {
  id: string;
  doc_type: string;
  reference: string | null;
  has_file: boolean;
  content_type: string | null;
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
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
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

  const pickFile = async () => {
    setFormError(null);
    // Harmless/no-op on web; on native the library picker generally needs no
    // explicit grant, but requesting first keeps iOS happy.
    await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]) setPicked(res.assets[0]);
  };

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const form = new FormData();
      form.append("doc_type", docType);
      if (reference.trim()) form.append("note", reference.trim());
      if (picked) {
        const mime = picked.mimeType ?? "image/jpeg";
        if (Platform.OS === "web" && picked.file) {
          form.append("file", picked.file);
        } else {
          const name = picked.fileName ?? `document.${mime.split("/")[1] ?? "jpg"}`;
          // React Native's FormData accepts this {uri,name,type} shape for files.
          form.append("file", { uri: picked.uri, name, type: mime } as unknown as Blob);
        }
      }
      await api.postForm("/api/v1/mp/partner/verification/documents", form);
      setReference("");
      setPicked(null);
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
            Pick a type, attach a clear photo, and add a short reference — never the full ID number.
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
          <View style={{ marginBottom: 10 }}>
            <Button
              label={picked ? "Change photo" : "Attach photo"}
              variant="outline"
              onPress={pickFile}
            />
            {picked ? (
              <Text style={{ color: colors.forest, fontSize: 12, marginTop: 6 }}>
                ✓ {picked.fileName ?? "Photo attached"}
              </Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
                JPEG, PNG or WebP · up to 10 MB. Optional, but speeds up review.
              </Text>
            )}
          </View>
          {formError ? <Text style={{ color: colors.tomato, marginBottom: 8 }}>{formError}</Text> : null}
          <Button label={submitting ? "Submitting…" : "Submit document"} onPress={submit} loading={submitting} />
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
            <Text style={{ color: d.has_file ? colors.forest : colors.muted, fontSize: 12, marginTop: 2 }}>
              {d.has_file ? "✓ File attached" : "No file attached"}
            </Text>
            {d.decision_reason ? (
              <Text style={{ color: colors.tomato, fontSize: 12, marginTop: 2 }}>{d.decision_reason}</Text>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
