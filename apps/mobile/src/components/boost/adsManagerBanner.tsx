import { Pressable, StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { ArrowUpRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { adsManagerConfig } from "@/config/adsManager.config";
import { makeThemedStyles, useTheme } from "@/theme";

export function AdsManagerBanner() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Open Zudomart Ads Manager" onPress={() => openTrustedWebPage(adsManagerConfig.adsManagerUrl, inAppBrowserColorsFromTheme(colors))} style={styles.banner}>
      <View style={styles.flex}>
        <Text size={14} weight={600} lineHeight={16.8}>Need full campaigns?</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Open Zudomart Ads Manager for product catalogues, A/B tests and detailed reports.</Text>
      </View>
      <ArrowUpRight24Icon />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  banner: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.primaryTint },
}));
