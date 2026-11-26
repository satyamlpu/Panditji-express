import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  AppHeader,
  Avatar,
  Button,
  Card,
  FormInput,
  Icon,
  InlineError,
  Loading,
  ErrorState,
  PressableScale,
  SectionHeader,
  TAB_BAR_SPACE,
  Txt,
  spacing,
  radius,
  useColors,
  useStatusBarStyle,
  haptics,
  type IconName,
} from "../../design";

interface Me {
  id: string;
  phone: string;
  name: string | null;
  language: string | null;
}

export default function Profile() {
  const { signOut } = useAuth();
  const colors = useColors();
  useStatusBarStyle("dark");
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(() => {
    api
      .get<Me>("/api/v1/mp/customer/profile")
      .then((m) => {
        setMe(m);
        setName(m.name ?? "");
        setLanguage(m.language ?? "");
      })
      .catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (!me) {
    if (loadError) return <ErrorState body="Could not load your profile." onRetry={loadProfile} />;
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
      haptics.success();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <AppHeader title="Profile" />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE, gap: spacing.md }}>
        {/* Identity */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Avatar name={me.name} size={56} />
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{me.name || "Add your name"}</Txt>
              <Txt variant="callout" color={colors.inkSecondary}>
                {me.phone}
              </Txt>
            </View>
          </View>
        </Card>

        {/* Editable details */}
        <Card>
          <SectionHeader title="Your details" />
          <FormInput
            label="Name"
            icon="profile"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setSaved(false);
            }}
            placeholder="Your name"
          />
          <FormInput
            label="Preferred language"
            icon="language"
            value={language}
            onChangeText={(t) => {
              setLanguage(t);
              setSaved(false);
            }}
            placeholder="e.g. Hindi"
          />
          {error ? <View style={{ marginBottom: spacing.md }}><InlineError message={error} /></View> : null}
          {saved ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md }}>
              <Icon name="checkCircle" size={16} color={colors.success} />
              <Txt variant="callout" color={colors.success}>
                Changes saved
              </Txt>
            </View>
          ) : null}
          <Button label={saving ? "Saving…" : "Save changes"} onPress={save} loading={saving} disabled={!dirty} />
        </Card>

        {/* Links */}
        <Card padded={false}>
          <LinkRow icon="location" label="Saved addresses" onPress={() => router.push("/addresses")} first />
          <LinkRow icon="support" label="Help & support" onPress={() => router.push("/support")} />
          <LinkRow icon="alerts" label="Notifications" onPress={() => router.push("/(tabs)/notifications")} />
        </Card>

        <Button
          label="Sign out"
          variant="outline"
          icon="signout"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        />
        <Txt variant="caption" color={colors.inkMuted} style={{ textAlign: "center", marginTop: spacing.sm }}>
          Pandit Ji Express · Customer app
        </Txt>
      </ScrollView>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  first,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  first?: boolean;
}) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.99}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        borderRadius: radius.lg,
      }}
    >
      <Icon name={icon} size={20} color={colors.primary} />
      <Txt variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Icon name="chevron" size={18} color={colors.inkMuted} />
    </PressableScale>
  );
}
