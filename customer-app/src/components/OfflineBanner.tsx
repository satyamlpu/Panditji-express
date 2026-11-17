import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";
import { useOnline } from "../lib/net";
import { colors } from "../theme";

// App-wide offline indicator. Overlays the bottom of the screen (absolute) so it
// never shifts layout; rendered only while the device reports no connection.
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  if (online) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.tomato,
        paddingTop: 10,
        paddingBottom: insets.bottom + 10,
        paddingHorizontal: 16,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.white, fontWeight: "800", fontSize: 13 }}>⚠ {t("offline")}</Text>
    </View>
  );
}
