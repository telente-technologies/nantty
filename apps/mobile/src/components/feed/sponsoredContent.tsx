import { useNavigation } from "@react-navigation/native";
import { Linking, Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { adEventsService } from "@/services/adEvents.service";
import type { AdPlacement, ID, SponsoredPlacement } from "@/types";

export function SponsoredLabel({ sponsored, color = colors.textSubtle }: { sponsored: SponsoredPlacement; color?: string }) {
  return (
    <Text size={12} weight={400} lineHeight={16.8} color={color} accessibilityLabel={`${sponsored.label} by ${sponsored.advertiserName}`}>
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
  const navigation = useNavigation();
  if (!sponsored.ctaLabel) return null;
  const openAdvertiserLinkAndRecordClick = () => {
    adEventsService.recordSponsoredClick(sponsored, placement, itemId);
    const ctaUrl = sponsored.ctaUrl;
    if (!ctaUrl) return;
    const productRouteMatch = ctaUrl.match(/\/products\/([^/?#]+)/);
    if (productRouteMatch) {
      navigation.navigate("ProductDetail", { productId: decodeURIComponent(productRouteMatch[1]) });
      return;
    }
    const storeRouteMatch = ctaUrl.match(/\/stores\/([^/?#]+)/);
    if (storeRouteMatch) {
      navigation.navigate("Store", { storeId: decodeURIComponent(storeRouteMatch[1]) });
      return;
    }
    if (/^https:\/\//.test(ctaUrl)) Linking.openURL(ctaUrl).catch(() => undefined);
  };
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${sponsored.ctaLabel}, ${sponsored.advertiserName}`}
      onPress={openAdvertiserLinkAndRecordClick}
      style={[styles.callToAction, { marginHorizontal: horizontalMargin }]}
    >
      <Text size={14} weight={500} lineHeight={16.8} color={colors.white}>
        {sponsored.ctaLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  callToAction: {
    height: 36,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
