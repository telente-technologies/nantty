import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";

import { ArrowUpRight24Icon, BuildingStore20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useAuthStore } from "@/store/auth.store";

export function SellOnNanttyBanner() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const signedInUserIsSeller = useAuthStore((state) => state.user?.isSeller ?? false);
  if (signedInUserIsSeller) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Start selling on Nantty" onPress={() => navigation.navigate("SellerApplication")} style={styles.banner}>
      <BuildingStore20Icon color={colors.primary} />
      <View style={styles.texts}>
        <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>Have something to sell?</Text>
        <Text size={12} lineHeight={16} color={colors.textMuted}>Open your store on Nantty — get paid safely through escrow.</Text>
      </View>
      <ArrowUpRight24Icon size={18} color={colors.primary} />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: { marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: colors.primaryTint, flexDirection: "row", alignItems: "center", gap: 10 },
  texts: { flex: 1, gap: 2 },
}));
