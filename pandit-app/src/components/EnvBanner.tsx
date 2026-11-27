import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "../design";
import { API_HOST, ENV_LABEL, IS_TESTING } from "../lib/env";

// Always-on indicator for non-production (testing / staging / dev) builds, so a
// tester can never confuse a testing APK with the live app. Overlays the very
// top of the screen, above every route, and is pointer-transparent so it never
// intercepts taps. Renders nothing in production builds.
export function EnvBanner() {
  const insets = useSafeAreaInsets();
  if (!IS_TESTING) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        elevation: 9999,
        backgroundColor: palette.saffron,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 2,
        }}
      >
        <Text
          style={{
            color: palette.white,
            fontWeight: "800",
            fontSize: 10,
            letterSpacing: 0.5,
          }}
        >
          ⚠ {ENV_LABEL} ENVIRONMENT · {API_HOST}
        </Text>
      </View>
    </View>
  );
}
