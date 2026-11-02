import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError, setToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Pandit } from "../lib/model";
import { Button, Field } from "../components/ui";
import { colors } from "../theme";

export default function Login() {
  const { signIn } = useAuth();
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
        kind: "pandit",
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
        kind: "pandit",
        code: code.trim(),
        name: name.trim() || undefined,
      });
      await signIn(r.access_token);
      // Route by verification state: approved partners go to the dashboard,
      // everyone else into onboarding (which shows the right state).
      setToken(r.access_token);
      const me = await api.get<Pandit>("/api/v1/mp/partner/profile");
      router.replace(me.status === "approved" ? "/(tabs)" : "/onboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.forest }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Forest hero */}
        <View style={{ alignItems: "center", paddingTop: 54, paddingBottom: 40 }}>
          <View
            style={{
              width: 72, height: 72, borderRadius: 20, backgroundColor: colors.sunshine,
              alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 36 }}>🕉️</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: "900", color: colors.white, letterSpacing: -0.5 }}>
            Pandit Ji Partner
          </Text>
          <Text style={{ color: colors.sunshine, marginTop: 4, fontWeight: "700" }}>
            Earn by serving pujas near you
          </Text>
        </View>

        {/* White sheet */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingTop: 28,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 16 }}>
            {step === "phone" ? "Partner login / sign up" : "Verify your number"}
          </Text>

          {step === "phone" ? (
            <>
              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+91 ..."
              />
              <Button label="Send OTP" onPress={requestOtp} loading={busy} />
            </>
          ) : (
            <>
              <Field
                label="Enter OTP"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="6-digit code"
              />
              {devCode && (
                <Text style={{ color: colors.muted, marginBottom: 12, fontSize: 13 }}>
                  Dev OTP: {devCode}
                </Text>
              )}
              <Field label="Your name (optional)" value={name} onChangeText={setName} placeholder="Full name" />
              <Button label="Verify & continue" onPress={verify} loading={busy} />
              <View style={{ height: 10 }} />
              <Button label="Change number" variant="outline" onPress={() => setStep("phone")} />
            </>
          )}

          {error && (
            <Text style={{ color: colors.tomato, marginTop: 14, textAlign: "center" }}>{error}</Text>
          )}

          <Text style={{ color: colors.muted, fontSize: 11.5, textAlign: "center", marginTop: 22 }}>
            By continuing you agree to our Partner Terms & Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
