import { useNavigation } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export type RoleGateKind = "seller" | "creator";

const gateCopy: Readonly<Record<RoleGateKind, { readonly title: string; readonly body: string; readonly action: string; readonly route: string }>> = {
  seller: {
    title: "Become a seller",
    body: "Only approved sellers can publish products to the Mart. Apply to sell: it's free, and once your store is approved you can list products from here or the seller dashboard.",
    action: "Apply to sell",
    route: "SellerApplication",
  },
  creator: {
    title: "Join the Creator Program",
    body: "Going live is for approved creators. Join the Creator Program to stream, earn from gifts and subscriptions, and host battles.",
    action: "Join the Creator Program",
    route: "CreatorProgram",
  },
};

export function RoleGateScreen({ kind }: { readonly kind: RoleGateKind }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const copy = gateCopy[kind];
  const openApplication = () => (navigation as unknown as { replace: (name: string) => void }).replace(copy.route);
  return (
    <Screen>
      <Header title={copy.title} />
      <View style={styles.body} accessibilityRole="summary">
        <Text size={22} weight={700} lineHeight={28} align="center">{copy.title}</Text>
        <Text size={15} lineHeight={22} align="center" color={colors.textMuted}>{copy.body}</Text>
        <Button title={copy.action} onPress={openApplication} />
        <Button title="Not now" variant="outline" onPress={() => (navigation.canGoBack() ? navigation.goBack() : undefined)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1, justifyContent: "center", gap: 16, paddingHorizontal: 24 } });
