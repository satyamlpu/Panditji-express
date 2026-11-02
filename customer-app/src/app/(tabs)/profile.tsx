import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Card, Loading } from "../../components/ui";
import { colors } from "../../theme";

interface Me {
  id: string;
  phone: string;
  name: string | null;
  language: string | null;
}

export default function Profile() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.get<Me>("/api/v1/mp/customer/profile").then(setMe).catch(() => {});
  }, []);

  if (!me) return <Loading />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>
          {me.name ?? "Customer"}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{me.phone}</Text>
        {me.language ? (
          <Text style={{ color: colors.muted, marginTop: 2 }}>Language: {me.language}</Text>
        ) : null}
      </Card>

      <Button
        label="Sign out"
        variant="outline"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
      <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20, fontSize: 12 }}>
        Pandit Ji Express · Customer app
      </Text>
    </ScrollView>
  );
}
