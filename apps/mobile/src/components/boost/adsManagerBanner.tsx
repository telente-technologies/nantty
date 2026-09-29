import { Linking, Pressable, StyleSheet, View } from "react-native";

import { ArrowUpRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { adsManagerConfig } from "@/config/adsManager.config";
import { colors } from "@/constants/colors.constant";

export function AdsManagerBanner() {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Open Zudomart Ads Manager" onPress={() => Linking.openURL(adsManagerConfig.adsManagerUrl)} style={styles.banner}>
      <View style={styles.flex}>
        <Text size={14} weight={600} lineHeight={16.8}>Need full campaigns?</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Open Zudomart Ads Manager for product catalogues, A/B tests and detailed reports.</Text>
      </View>
      <ArrowUpRight24Icon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  banner: { backgroundColor: colors.white, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.primaryTint },
});
