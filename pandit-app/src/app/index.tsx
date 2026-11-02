import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { colors } from "../theme";

export default function Splash() {
  const { token, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1100);
    return () => clearTimeout(t);
  }, []);

  if (!loading && minElapsed) {
    return <Redirect href={token ? "/(tabs)" : "/login"} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 24,
          backgroundColor: colors.sunshine,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Text style={{ fontSize: 44 }}>🕉️</Text>
      </View>
      <Text style={{ color: colors.white, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>
        Pandit Ji Partner
      </Text>
      <Text style={{ color: colors.sunshine, marginTop: 6, fontWeight: "700" }}>
        Earn by serving pujas near you
      </Text>
    </View>
  );
}
