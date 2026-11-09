import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { adEventsService } from "@/services/ads/adEvents.service";
import { openSponsoredTarget } from "@/services/ads/adClick.service";
import { productAdSponsoredPlacement, productAdsService, usableMartProductAd } from "@/services/ads/productAds.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { labelForCallToAction } from "@/utils/adCreativeMapping.util";
import {
  MART_PRODUCT_AD_MINIMUM_VISIBLE_FRACTION,
  MART_PRODUCT_AD_MINIMUM_VISIBLE_MILLIS,
  martProductAdVisibleFraction,
} from "./martProductAdViewability.util";

export interface MartProductAdViewport {
  scrollOffset: number;
  viewportHeight: number;
  contentTop: number;
}

export function MartProductAd({
  viewport,
  registerViewabilityEvaluator,
}: {
  readonly viewport: MutableRefObject<MartProductAdViewport>;
  readonly registerViewabilityEvaluator: (evaluator: (() => void) | null) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const focused = useIsFocused();
  const navigation = useNavigation();
  const viewerId = useAuthStore((state) => state.status === "signedIn" ? state.user?.id ?? null : null);
  const decision = useQuery({
    queryKey: ["ads", "mart-product-slot", viewerId],
    queryFn: productAdsService.decideMartProductAd,
    enabled: Boolean(viewerId),
    staleTime: 60_000,
    retry: false,
  });
  const ad = usableMartProductAd(decision.data?.ad, decision.data?.receivedAt ?? 0) ? decision.data.ad : null;
  const sponsored = ad ? productAdSponsoredPlacement(ad) : null;
  const media = ad?.creative.media.find((item) => item.kind === "image");
  const [cardBounds, setCardBounds] = useState<{ readonly top: number; readonly height: number } | null>(null);
  const [isSufficientlyVisible, setIsSufficientlyVisible] = useState(false);
  const impressionRecorded = useRef<string | null>(null);

  const evaluateViewability = useCallback(() => {
    if (!cardBounds) {
      setIsSufficientlyVisible(false);
      return;
    }
    const fraction = martProductAdVisibleFraction({
      contentTop: viewport.current.contentTop,
      cardTop: cardBounds.top,
      cardHeight: cardBounds.height,
      scrollOffset: viewport.current.scrollOffset,
      viewportHeight: viewport.current.viewportHeight,
    });
    setIsSufficientlyVisible(fraction >= MART_PRODUCT_AD_MINIMUM_VISIBLE_FRACTION);
  }, [cardBounds, viewport]);

  useEffect(() => {
    registerViewabilityEvaluator(evaluateViewability);
    return () => registerViewabilityEvaluator(null);
  }, [evaluateViewability, registerViewabilityEvaluator]);

  useEffect(() => {
    if (!focused || !isSufficientlyVisible || !sponsored || !ad || impressionRecorded.current === ad.adId) return;
    const timeout = setTimeout(() => {
      impressionRecorded.current = ad.adId;
      adEventsService.recordSponsoredImpressionOncePerSession(sponsored, "mart", ad.adId);
    }, MART_PRODUCT_AD_MINIMUM_VISIBLE_MILLIS);
    return () => clearTimeout(timeout);
  }, [focused, isSufficientlyVisible, sponsored, ad]);

  if (!ad || !sponsored) return null;
  const open = () => void openSponsoredTarget({ sponsored, placement: "mart", itemId: ad.adId, target: { kind: "cta" }, navigation });

  return (
    <View
      style={styles.card}
      testID="mart-product-ad"
      onLayout={({ nativeEvent }) => {
        setCardBounds({ top: nativeEvent.layout.y, height: nativeEvent.layout.height });
      }}
    >
      <View style={styles.identityRow}>
        <Text size={13} weight={600} lineHeight={17} numberOfLines={1} style={styles.identity}>{ad.creative.identity.name}</Text>
        {ad.creative.identity.verifiedBusiness ? <Text size={11} lineHeight={14} color={colors.textMuted}>Verified business</Text> : null}
        <Text size={12} lineHeight={16} color={colors.textMuted} accessibilityLabel="Advertisement">{ad.label}</Text>
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`${ad.creative.headline}, sponsored product`} onPress={open} style={styles.content}>
        {media ? <Image source={{ uri: media.url }} style={styles.image} contentFit="cover" /> : null}
        <View style={styles.copy}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={2}>{ad.creative.headline}</Text>
          {ad.creative.primaryText.trim() ? <Text size={13} lineHeight={17} color={colors.textMuted} numberOfLines={2}>{ad.creative.primaryText}</Text> : null}
        </View>
      </Pressable>
      <Button title={labelForCallToAction(ad.creative.callToAction, "Shop now")} height={36} onPress={open} accessibilityLabel={`${labelForCallToAction(ad.creative.callToAction, "Shop now")}, ${ad.creative.headline}`} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, padding: 12, gap: 10, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, borderRadius: 12 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  identity: { flexShrink: 1 },
  content: { flexDirection: "row", alignItems: "center", gap: 12 },
  image: { width: 84, height: 84, borderRadius: 8, backgroundColor: colors.skeleton },
  copy: { flex: 1, gap: 4 },
}));
