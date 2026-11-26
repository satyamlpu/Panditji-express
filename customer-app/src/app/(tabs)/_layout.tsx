import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Loading, GlassTabBar, type IconName } from "../../design";

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  bookings: "bookings",
  notifications: "alerts",
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
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
