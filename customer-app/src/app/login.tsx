import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  Button,
  FormInput,
  InlineError,
  Txt,
  palette,
  radius,
  spacing,
  useColors,
  haptics,
} from "../design";

export default function Login() {
  const { signIn } = useAuth();
  const colors = useColors();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+91");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ dev_code: string | null }>("/api/v1/mp/auth/otp/request", {
        phone: phone.trim(),
        kind: "customer",
      });
      setDevCode(r.dev_code);
      if (r.dev_code) setCode(r.dev_code);
      setStep("otp");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send OTP. Is the server running?");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ access_token: string }>("/api/v1/mp/auth/otp/verify", {
        phone: phone.trim(),
        kind: "customer",
        code: code.trim(),
        name: name.trim() || undefined,
      });
      await signIn(r.access_token);
      haptics.success();
      router.replace("/(tabs)");
    } catch (e) {
      haptics.error();
      setError(e instanceof ApiError ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Emerald hero */}
          <LinearGradient colors={[palette.crimsonDeep, palette.crimson]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <SafeAreaView edges={["top"]}>
              <View style={{ alignItems: "center", paddingTop: spacing.huge, paddingBottom: spacing.huge + 12 }}>
                <View
                  style={{
                    width: 78,
                    height: 78,
                    borderRadius: radius.xl,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    borderColor: palette.gold,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: spacing.lg,
                  }}
                >
                  <Text style={{ fontSize: 40, lineHeight: 46, color: palette.gold, fontWeight: "600" }}>ॐ</Text>
                </View>
                <Txt variant="h1" color={palette.white}>
                  Pandit Ji Express
                </Txt>
                <Txt variant="callout" color={palette.goldSoft} style={{ marginTop: 4 }}>
                  Tradition, at your doorstep
                </Txt>
              </View>
            </SafeAreaView>
          </LinearGradient>

          {/* White sheet */}
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              marginTop: -20,
              padding: spacing.xxl,
              paddingTop: spacing.xxl + 4,
            }}
          >
            <Txt variant="h2" style={{ marginBottom: 4 }}>
              {step === "phone" ? "Log in or sign up" : "Verify your number"}
            </Txt>
            <Txt variant="body" color={colors.inkSecondary} style={{ marginBottom: spacing.xl }}>
              {step === "phone"
                ? "We'll send a one-time code to your phone."
                : `Enter the code sent to ${phone}.`}
            </Txt>

            {step === "phone" ? (
              <>
                <FormInput
                  label="Phone number"
                  icon="phone"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+91 00000 00000"
                />
                <Button label="Send OTP" iconRight="forward" onPress={requestOtp} loading={busy} size="lg" />
              </>
            ) : (
              <>
                <FormInput
                  label="One-time code"
                  icon="shield"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  hint={devCode ? `Dev OTP: ${devCode}` : undefined}
                />
                <FormInput
                  label="Your name (optional)"
                  icon="profile"
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                />
                <Button label="Verify & continue" onPress={verify} loading={busy} size="lg" />
                <View style={{ height: spacing.md }} />
                <Button label="Change number" variant="ghost" onPress={() => setStep("phone")} />
              </>
            )}

            {error ? (
              <View style={{ marginTop: spacing.lg }}>
                <InlineError message={error} />
              </View>
            ) : null}

            <Txt variant="caption" color={colors.inkMuted} style={{ textAlign: "center", marginTop: spacing.xl }}>
              By continuing you agree to our Terms & Privacy Policy.
            </Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
