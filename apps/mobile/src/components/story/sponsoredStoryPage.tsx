import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { openTrustedWebPage } from "@/components/links/openLink.util";
import { useTheme } from "@/theme";
import type { StoryDecidedAd } from "@/types/social.type";
import { storyAdsService } from "@/services/clips/storyAds.service";

const IMAGE_AD_SECONDS = 6;

export interface SponsoredStoryPageProps {
  readonly ad: StoryDecidedAd;
  readonly onFinished: () => void;
  readonly onOpenDestination: (ad: StoryDecidedAd) => void;
}

export function SponsoredStoryPage({ ad, onFinished, onOpenDestination }: SponsoredStoryPageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const media = ad.creative.media[0];
  const [elapsed, setElapsed] = useState(0);
  const skipAfter = ad.skipAfterSeconds ?? IMAGE_AD_SECONDS;
  const canSkip = elapsed >= skipAfter;

  useEffect(() => {
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (media?.kind !== "video" && seconds >= IMAGE_AD_SECONDS) {
        clearInterval(timer);
        onFinished();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ad.adId, media?.kind, onFinished]);

  useEffect(() => {
    storyAdsService.recordStoryAdImpression(ad);
  }, [ad]);

  return (
    <View style={[styles.page, { paddingTop: insets.top + 4 }]}>
      <View style={styles.media}>
        {media?.kind === "video" && media.url ? (
          <ClipVideoPlayer
            media={{ type: "video", url: media.url, posterUrl: media.posterUrl ?? undefined, width: media.width ?? undefined, height: media.height ?? undefined, durationSeconds: media.durationSeconds ?? undefined }}
            isActive
            isMuted={false}
            style={StyleSheet.absoluteFill}
          />
        ) : media?.url ? (
          <Image source={{ uri: media.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <View style={styles.topRow}>
          <View style={styles.advertiser}>
            <Avatar uri={ad.creative.identity.avatarUrl} size={32} />
            <View style={styles.texts}>
              <Text size={14} weight={600} lineHeight={16.8} color={colors.white} numberOfLines={1}>
                {ad.creative.identity.name}
              </Text>
              <Text size={11} weight={700} lineHeight={14} color={colors.white}>
                Sponsored
              </Text>
            </View>
          </View>
          {canSkip ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Skip ad" hitSlop={10} onPress={onFinished} style={styles.skip}>
              <Text size={13} weight={600} lineHeight={16} color={colors.white}>
                Skip
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <Text size={15} weight={600} lineHeight={20} color={colors.white} numberOfLines={2}>
            {ad.creative.headline}
          </Text>
          {ad.creative.primaryText ? (
            <Text size={13} lineHeight={17} color={colors.white} numberOfLines={2}>
              {ad.creative.primaryText}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${ad.creative.callToAction}`}
            onPress={() => {
              storyAdsService.recordStoryAdClick(ad);
              onOpenDestination(ad);
            }}
            style={[styles.cta, { backgroundColor: colors.white }]}
          >
            <Text size={14} weight={700} lineHeight={18} color={colors.black}>
              {ad.creative.callToAction || "Learn more"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000000" },
  media: { flex: 1 },
  topRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  advertiser: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  texts: { flex: 1, gap: 1 },
  skip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)" },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 24, gap: 8 },
  cta: { alignSelf: "flex-start", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
});
