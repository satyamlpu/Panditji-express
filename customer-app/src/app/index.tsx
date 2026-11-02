import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { colors } from "../theme";

// Blinkit-style yellow splash, then route by auth state.
export default function Index() {
  const { token, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!loading && minElapsed) {
    return <Redirect href={token ? "/(tabs)" : "/login"} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.sunshine, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 24,
          backgroundColor: colors.forest,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 46, color: colors.sunshine }}>🕉️</Text>
      </View>
      <Text style={{ fontSize: 30, fontWeight: "900", color: colors.forest, marginTop: 18, letterSpacing: -0.5 }}>
        Pandit Ji Express
      </Text>
      <Text style={{ color: colors.forestDark, marginTop: 6, fontWeight: "700" }}>
        India&apos;s last-minute puja app
      </Text>
      <Text style={{ position: "absolute", bottom: 44, color: colors.forestDark, opacity: 0.7, fontSize: 12 }}>
        Book verified pandits in minutes
      </Text>
    </View>
  );
}
