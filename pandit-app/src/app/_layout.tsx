import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { I18nProvider } from "../lib/i18n";
import { OfflineBanner } from "../components/OfflineBanner";
import { colors } from "../theme";
import "../lib/observability";

function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.forest },
            headerTintColor: colors.white,
            headerTitleStyle: { color: colors.white, fontWeight: "800" },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="onboard" options={{ title: "Partner onboarding" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="job/[id]" options={{ title: "Active puja" }} />
        </Stack>
          <OfflineBanner />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
