import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { openSponsoredTarget } from "@/services/ads/adClick.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AdPlacement, ID, SponsoredPlacement } from "@/types";

interface SponsoredAppInstallRowProps {
  readonly sponsored: SponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly horizontalMargin?: number;
}

export function SponsoredAppInstallRow({ sponsored, placement, itemId, horizontalMargin = 0 }: SponsoredAppInstallRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const app = sponsored.app;
  if (!app) return null;
  const install = () => openSponsoredTarget({ sponsored, placement, itemId, target: { kind: "cta" }, navigation });
  return (
    <View style={[styles.row, { marginHorizontal: horizontalMargin }]}>
      {app.iconUrl ? <Image source={{ uri: app.iconUrl }} style={styles.icon} contentFit="cover" accessibilityLabel={`${app.appName} icon`} /> : <View style={styles.icon} />}
      <View style={styles.meta}>
        <Text size={14} weight={600} lineHeight={18} numberOfLines={1}>
          {app.appName}
        </Text>
        {app.rating ? (
          <Text size={12} lineHeight={16} color={colors.textMuted} accessibilityLabel={`Rated ${app.rating.toFixed(1)} out of 5`}>
            {app.rating.toFixed(1)} of 5
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`${sponsored.ctaLabel ?? "Install"} ${app.appName}`} onPress={install} style={styles.button}>
        <Text size={13} weight={600} lineHeight={16} color={colors.white}>
          {sponsored.ctaLabel ?? "Install"}
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, backgroundColor: colors.surface },
    icon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.media },
    meta: { flex: 1, gap: 2 },
    button: { minHeight: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  }),
);
