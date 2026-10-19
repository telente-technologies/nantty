import { Pressable, StyleSheet } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { ArrowUpRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { adsManagerConfig } from "@/config/adsManager.config";
import { makeThemedStyles, useTheme } from "@/theme";

export function AdsManagerBanner() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Need more? Open Ads Manager. Optional, for catalogues, A/B tests and detailed reports."
      onPress={() => openTrustedWebPage(adsManagerConfig.adsManagerUrl, inAppBrowserColorsFromTheme(colors))}
      style={styles.link}
    >
      <Text size={13} lineHeight={16.9} color={colors.textMuted} style={styles.flex}>
        Need more? <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>Open Ads Manager</Text>
      </Text>
      <ArrowUpRight24Icon size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
}));
