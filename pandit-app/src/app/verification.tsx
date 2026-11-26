import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { api, ApiError } from "../lib/api";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  FormInput,
  Icon,
  InlineError,
  Loading,
  StatusIndicator,
  Txt,
  WrapRow,
  spacing,
  useColors,
  haptics,
} from "../design";

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
  const colors = useColors();
  const [data, setData] = useState<Verification | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [docType, setDocType] = useState("id_proof");
  const [reference, setReference] = useState("");
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Verification>("/api/v1/mp/partner/verification").then(setData).catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const pickFile = async () => {
    setFormError(null);
    await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
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
          form.append("file", { uri: picked.uri, name, type: mime } as unknown as Blob);
        }
      }
      await api.postForm("/api/v1/mp/partner/verification/documents", form);
      setReference("");
      setPicked(null);
      haptics.success();
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) {
    if (loadError) return <ErrorState body="Could not load your verification." onRetry={() => { setLoadError(false); load(); }} />;
    return <Loading />;
  }

  const approved = data.status === "approved";

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={{ borderColor: approved ? colors.success : colors.border, borderWidth: approved ? 1.5 : 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name={approved ? "verified" : "shield"} size={20} color={approved ? colors.success : colors.primary} />
            <Txt variant="h3">Verification</Txt>
          </View>
          <StatusIndicator status={data.status} />
        </View>
        <Txt variant="callout" color={approved ? colors.success : colors.inkSecondary} style={{ marginTop: spacing.sm }}>
          {approved
            ? "You're verified — go online and accept bookings."
            : "Submit your KYC documents below. Our team will review and approve your account."}
        </Txt>
      </Card>

      {!approved ? (
        <Card>
          <Txt variant="bodyStrong">Submit a document</Txt>
          <Txt variant="caption" color={colors.inkSecondary} style={{ marginTop: 4, marginBottom: spacing.md }}>
            Pick a type, attach a clear photo, and add a short reference — never the full ID number.
          </Txt>
          <WrapRow>
            {DOC_TYPES.map((t) => (
              <Chip key={t.key} label={t.label} selected={docType === t.key} onPress={() => setDocType(t.key)} />
            ))}
          </WrapRow>
          <View style={{ height: spacing.sm }} />
          <FormInput label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="e.g. Aadhaar — last 4: 1234" />
          <Button label={picked ? "Change photo" : "Attach photo"} variant="outline" icon="camera" onPress={pickFile} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: spacing.md }}>
            <Icon name={picked ? "checkCircle" : "camera"} size={14} color={picked ? colors.success : colors.inkMuted} />
            <Txt variant="caption" color={picked ? colors.success : colors.inkMuted}>
              {picked ? picked.fileName ?? "Photo attached" : "JPEG, PNG or WebP · up to 10 MB. Optional, but speeds up review."}
            </Txt>
          </View>
          {formError ? <View style={{ marginBottom: spacing.md }}><InlineError message={formError} /></View> : null}
          <Button label={submitting ? "Submitting…" : "Submit document"} onPress={submit} loading={submitting} />
        </Card>
      ) : null}

      <Txt variant="h3" style={{ marginTop: spacing.sm }}>
        Submitted documents
      </Txt>
      {data.documents.length === 0 ? (
        <Txt variant="callout" color={colors.inkSecondary}>
          Nothing submitted yet.
        </Txt>
      ) : (
        data.documents.map((d) => (
          <Card key={d.id}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <Txt variant="bodyStrong" style={{ textTransform: "capitalize" }}>
                {d.doc_type.replace(/_/g, " ")}
              </Txt>
              <StatusIndicator status={d.status} />
            </View>
            {d.reference ? (
              <Txt variant="callout" color={colors.inkSecondary} style={{ marginTop: 2 }}>
                {d.reference}
              </Txt>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Icon name={d.has_file ? "checkCircle" : "close"} size={13} color={d.has_file ? colors.success : colors.inkMuted} />
              <Txt variant="caption" color={d.has_file ? colors.success : colors.inkMuted}>
                {d.has_file ? "File attached" : "No file attached"}
              </Txt>
            </View>
            {d.decision_reason ? (
              <Txt variant="caption" color={colors.error} style={{ marginTop: 2 }}>
                {d.decision_reason}
              </Txt>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
