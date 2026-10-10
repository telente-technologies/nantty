import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { SponsoredAppInstallRow } from "@/components/feed/sponsoredAppInstall";
import { SponsoredCarousel } from "@/components/feed/sponsoredCarousel";
import { adEventsService } from "@/services/ads/adEvents.service";
import { openSponsoredTarget } from "@/services/ads/adClick.service";
import { sponsoredPlacementFromDecidedAd } from "@/utils/adCreativeMapping.util";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ThreadDecidedAd } from "@/types/postThread.type";

import { THREAD_AVATAR_SIZE } from "./threadReplyRow";

export function SponsoredThreadItem({ ad, postId }: { readonly ad: ThreadDecidedAd; readonly postId: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { creative } = ad;
  const sponsored = useMemo(() => sponsoredPlacementFromDecidedAd(ad), [ad]);
  const image = creative.media.find((item) => item.kind === "image");

  useEffect(() => {
    adEventsService.recordSponsoredImpressionOncePerSession(sponsored, "feedCommentThread", postId);
  }, [sponsored, postId]);

  const openMedia = () => openSponsoredTarget({ sponsored, placement: "feedCommentThread", itemId: postId, target: { kind: "cta" }, navigation });
  const isCarousel = sponsored.adType === "carousel" && (sponsored.cards?.length ?? 0) > 0;
  const isInstall = sponsored.adType === "app_install" && Boolean(sponsored.app);

  return (
    <View style={styles.row} accessibilityLabel={`Promoted by ${creative.identity.name}`}>
      <Avatar uri={creative.identity.avatarUrl} size={THREAD_AVATAR_SIZE} />
      <View style={styles.content}>
        <View style={styles.meta}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={1} style={styles.name}>
            {creative.identity.name}
          </Text>
          <VerificationBadge verification={null} legacyVerified={creative.identity.verifiedBusiness} size={15} />
          <Text size={14} lineHeight={19} color={colors.textMuted} numberOfLines={1} style={styles.handle}>
            @{creative.identity.handle}
          </Text>
        </View>
        <Text size={15} lineHeight={20}>
          {creative.primaryText}
        </Text>
        {isCarousel ? <SponsoredCarousel sponsored={sponsored} placement="feedCommentThread" itemId={postId} /> : null}
        {isInstall ? <SponsoredAppInstallRow sponsored={sponsored} placement="feedCommentThread" itemId={postId} /> : null}
        {isCarousel || isInstall ? null : (
          <Pressable accessibilityRole="link" accessibilityLabel={`${creative.headline}, ${sponsored.ctaLabel}`} onPress={openMedia} style={styles.card}>
            {image ? <Image source={{ uri: image.url }} style={[styles.media, { aspectRatio: image.width / Math.max(image.height, 1) }]} contentFit="cover" /> : null}
            <View style={styles.cardFooter}>
              <Text size={14} weight={500} lineHeight={18} numberOfLines={2} style={styles.headline}>
                {creative.headline}
              </Text>
              <View style={styles.cta}>
                <Text size={13} weight={600} lineHeight={16} color={colors.onPrimary}>
                  {sponsored.ctaLabel}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        <Text size={12} lineHeight={16} color={colors.textMuted} style={styles.promoted}>
          {ad.label}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    content: { flex: 1, gap: 6 },
    meta: { flexDirection: "row", alignItems: "center", gap: 4 },
    name: { flexShrink: 1 },
    handle: { flexShrink: 2 },
    card: { borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, backgroundColor: colors.surface },
    media: { width: "100%", backgroundColor: colors.media },
    cardFooter: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    headline: { flex: 1 },
    cta: { minHeight: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
    promoted: { marginTop: 2 },
  }),
);
