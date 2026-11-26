import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Loading, GlassTabBar, type IconName } from "../../design";

// Partner tab structure is preserved: Home · My pujas · Earnings · Profile.
const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  jobs: "pujas",
  earnings: "earnings",
  profile: "profile",
};

export default function TabsLayout() {
  const { token, loading } = useAuth();
  if (loading) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} icons={TAB_ICONS} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="jobs" options={{ title: "My pujas" }} />
      <Tabs.Screen name="earnings" options={{ title: "Earnings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
