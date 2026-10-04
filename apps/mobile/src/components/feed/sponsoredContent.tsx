import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { SponsoredAppInstallRow } from "@/components/feed/sponsoredAppInstall";
import { openSponsoredTarget } from "@/services/adClick.service";
import type { AdPlacement, ID, SponsoredPlacement } from "@/types";

export function SponsoredLabel({ sponsored, color }: { sponsored: SponsoredPlacement; color?: string }) {
  const { colors } = useTheme();
  return (
    <Text size={12} weight={400} lineHeight={16.8} color={color ?? colors.textSubtle} accessibilityLabel={`${sponsored.label} by ${sponsored.advertiserName}`}>
      {sponsored.label}
    </Text>
  );
}

export interface SponsoredCallToActionProps {
  readonly sponsored: SponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly horizontalMargin?: number;
}

export function SponsoredCallToAction({ sponsored, placement, itemId, horizontalMargin = 0 }: SponsoredCallToActionProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  if (sponsored.adType === "app_install" && sponsored.app) return <SponsoredAppInstallRow sponsored={sponsored} placement={placement} itemId={itemId} horizontalMargin={horizontalMargin} />;
  if (sponsored.adType === "carousel" || !sponsored.ctaLabel) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${sponsored.ctaLabel}, ${sponsored.advertiserName}`}
      onPress={() => openSponsoredTarget({ sponsored, placement, itemId, target: { kind: "cta" }, navigation })}
      style={[styles.callToAction, { marginHorizontal: horizontalMargin }]}
    >
      <Text size={14} weight={500} lineHeight={16.8} color={colors.white}>
        {sponsored.ctaLabel}
      </Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  callToAction: {
    height: 36,
    borderRadius: 4,
    backgroundColor: colors.primarySolid,
    alignItems: "center",
    justifyContent: "center",
  },
}));
