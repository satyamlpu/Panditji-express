import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Animated, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../lib/auth";
import { palette, radius, Txt, useReducedMotion } from "../design";

// Premium emerald splash, then route by auth state.
export default function Index() {
  const { token, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  const reduced = useReducedMotion();
  const fade = useMemo(() => new Animated.Value(reduced ? 1 : 0), [reduced]);
  const rise = useMemo(() => new Animated.Value(reduced ? 0 : 12), [reduced]);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1200);
    if (!reduced) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 4 }),
      ]).start();
    }
    return () => clearTimeout(t);
  }, [fade, rise, reduced]);

  if (!loading && minElapsed) {
    return <Redirect href={token ? "/(tabs)" : "/login"} />;
  }

  return (
    <LinearGradient
      colors={[palette.emeraldDeep, "#043A2C", palette.emerald]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={{ alignItems: "center", opacity: fade, transform: [{ translateY: rise }] }}>
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: radius.xl,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: palette.gold,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 56, lineHeight: 64, color: palette.gold, fontWeight: "600" }}>ॐ</Text>
        </View>
        <Txt variant="display" color={palette.white} style={{ marginTop: 22 }}>
          Pandit Ji Express
        </Txt>
        <Txt variant="callout" color={palette.goldSoft} style={{ marginTop: 6 }}>
          Tradition, at your doorstep
        </Txt>
      </Animated.View>
      <Txt
        variant="caption"
        color="rgba(234,243,236,0.6)"
        style={{ position: "absolute", bottom: 44 }}
      >
        Verified Panditjis for your sacred moments
      </Txt>
    </LinearGradient>
  );
}
