import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { openSponsoredTarget } from "@/services/ads/adClick.service";
import { productAdSponsoredPlacement, type ProductAd } from "@/services/ads/productAds.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AdPlacement } from "@/types";
import { labelForCallToAction } from "@/utils/adCreativeMapping.util";

import { SponsoredLabel } from "@/components/feed/sponsoredContent";

interface FeedProductAdCardProps {
  readonly ad: ProductAd;
  readonly placement?: Extract<AdPlacement, "feed" | "search">;
}

export function FeedProductAdCard({ ad, placement = "feed" }: FeedProductAdCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const sponsored = productAdSponsoredPlacement(ad);
  const image = ad.creative.media.find((media) => media.kind === "image");
  const ctaLabel = labelForCallToAction(ad.creative.callToAction, "Shop now");
  const openProduct = () => void openSponsoredTarget({
    sponsored,
    placement,
    itemId: ad.adId,
    target: { kind: "cta" },
    navigation,
  });

  return (
    <View style={styles.card} testID={placement === "search" ? "search-product-ad" : "feed-product-ad"}>
      <View style={styles.header}>
        <Avatar uri={ad.creative.identity.avatarUrl ?? null} size={32} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1} style={styles.name}>{ad.creative.identity.name}</Text>
            <VerificationBadge verification={null} legacyVerified={ad.creative.identity.verifiedBusiness} size={16} />
            <SponsoredLabel sponsored={sponsored} />
          </View>
          <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>@{ad.creative.identity.handle}</Text>
        </View>
      </View>
      {ad.creative.primaryText.trim() ? <Text size={14} lineHeight={18.2} style={styles.copy}>{ad.creative.primaryText}</Text> : null}
      <Pressable accessibilityRole="link" accessibilityLabel={`${ad.creative.headline}, sponsored product`} onPress={openProduct} style={styles.product}>
        {image ? <Image source={{ uri: image.url }} style={styles.image} contentFit="cover" /> : null}
        <View style={styles.productCopy}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={2}>{ad.creative.headline}</Text>
          <Text size={12} lineHeight={16} color={colors.textMuted}>Sponsored product</Text>
        </View>
      </Pressable>
      <Button title={ctaLabel} height={36} onPress={openProduct} accessibilityLabel={`${ctaLabel}, ${ad.creative.headline}`} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider, paddingVertical: 12, gap: 10 },
  header: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
  copy: { paddingHorizontal: 16 },
  product: { marginHorizontal: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, backgroundColor: colors.surface, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
  productCopy: { padding: 12, gap: 4 },
}));
