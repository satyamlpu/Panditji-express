import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { I18nProvider } from "../lib/i18n";
import { OfflineBanner } from "../components/OfflineBanner";
import { EnvBanner } from "../components/EnvBanner";
import { ThemeProvider, palette } from "../design";
import "../lib/observability";

function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.crimsonDeep },
                headerTintColor: palette.white,
                headerTitleStyle: { color: palette.white, fontWeight: "700" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: palette.ivory },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="addresses" options={{ title: "Saved addresses" }} />
              <Stack.Screen name="support" options={{ title: "Help & support" }} />
              <Stack.Screen name="ticket/[id]" options={{ title: "Support request" }} />
              <Stack.Screen name="book/[slug]" options={{ title: "Confirm booking" }} />
              <Stack.Screen name="booking/[id]" options={{ title: "Your booking" }} />
            </Stack>
            <OfflineBanner />
            <EnvBanner />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
