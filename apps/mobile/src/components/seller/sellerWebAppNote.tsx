import { StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { ArrowUpRight24Icon, BuildingStore20Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { sellerWebAppConfig } from "@/config/sellerWebApp.config";
import { makeThemedStyles, useTheme } from "@/theme";
import { BulletLine } from "@/components/ui/bulletLine";

const WEB_ONLY_TOOLS = ["Point of sale for your physical shop", "Advanced inventory and variants", "Staff accounts and roles", "Sales and tax reports"];

export function SellerWebAppNote() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <BuildingStore20Icon color={colors.primary} />
        <Text size={14} weight={600} lineHeight={16.8}>Need the full business toolkit?</Text>
      </View>
      <Text size={13} lineHeight={17.5} color={colors.textMuted}>
        The Zudomart Dashboard is available to verified sellers with a subscription:
      </Text>
      {WEB_ONLY_TOOLS.map((tool) => (
        <BulletLine key={tool} size={13} lineHeight={17.5}>
          {tool}
        </BulletLine>
      ))}
      <Button
        variant="subtle"
        title="Open Zudomart Dashboard"
        icon={<ArrowUpRight24Icon size={18} />}
        onPress={() => openTrustedWebPage(sellerWebAppConfig.dashboardUrl, inAppBrowserColorsFromTheme(colors))}
        style={styles.button}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  button: { marginTop: 8 },
}));
