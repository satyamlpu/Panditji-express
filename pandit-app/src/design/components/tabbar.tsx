/**
 * GlassTabBar — a floating, frosted bottom tab bar for expo-router's Tabs.
 * Vector icons, clear active state, safe-area aware, Android translucent fallback
 * (via Glass). Shared design system — mirrored into both apps.
 *
 * Screens must leave room so content isn't hidden under it: add
 * `contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}` to scroll views.
 */
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, radius, spacing } from "../tokens";
import { useColors } from "../theme";
import { haptics } from "../haptics";
import { Glass } from "../glass";
import { Icon, type IconName } from "../icons";

export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_SPACE = TAB_BAR_HEIGHT + 34; // bar + float margin, generous for scroll content

/**
 * Minimal structural shape of the props expo-router's (SDK 58) `Tabs` passes to a
 * custom `tabBar`. A subset is enough (and keeps us off the vendored
 * react-navigation build path); the full props object stays assignable at the
 * call site.
 */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarLabel?: unknown } }>;
  navigateToTab: (routeKey: string) => void;
}

export function GlassTabBar({
  state,
  descriptors,
  navigateToTab,
  icons,
}: TabBarProps & { icons: Record<string, IconName> }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        bottom: Math.max(insets.bottom, spacing.md),
        ...elevation.e2,
      }}
      pointerEvents="box-none"
    >
      <Glass radius={radius.xxl} intensity={40} style={{ flexDirection: "row", height: TAB_BAR_HEIGHT, backgroundColor: colors.surface }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const focused = state.index === index;

          const onPress = () => {
            haptics.select();
            if (!focused) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  borderRadius: radius.lg,
                  backgroundColor: focused ? colors.primaryTint : "transparent",
                  minWidth: 56,
                }}
              >
                <Icon
                  name={icons[route.name] ?? "home"}
                  size={22}
                  color={focused ? colors.primary : colors.inkMuted}
                  strokeWidth={focused ? 2.4 : 2}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    fontWeight: focused ? "700" : "500",
                    color: focused ? colors.primary : colors.inkMuted,
                  }}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}
