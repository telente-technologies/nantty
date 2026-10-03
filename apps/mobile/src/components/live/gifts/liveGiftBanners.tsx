import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

import { LiveGiftArtwork } from "./liveGiftArtwork";
import type { LiveGiftBannerEntry } from "./liveGiftOverlayQueues.hook";

const BANNER_TINT_BY_LEVEL = { micro: "rgba(0,0,0,0.45)", medium: "rgba(120,40,200,0.62)", large: "rgba(214,140,0,0.72)", global: "rgba(200,30,90,0.75)" } as const;

function LiveGiftBanner({ banner }: { banner: LiveGiftBannerEntry }) {
  const slideIn = useRef(new Animated.Value(0)).current;
  const comboScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(slideIn, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [slideIn]);

  useEffect(() => {
    if (banner.bumpKey === 0) return;
    comboScale.setValue(1.7);
    Animated.spring(comboScale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [banner.bumpKey, comboScale]);

  const { event } = banner;
  const translateX = slideIn.interpolate({ inputRange: [0, 1], outputRange: [-260, 0] });
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${event.sender.name} sent ${banner.giftName} times ${banner.comboCount}`}
      style={[styles.bannerRow, { opacity: slideIn, transform: [{ translateX }] }]}
    >
      <View style={[styles.pill, { backgroundColor: BANNER_TINT_BY_LEVEL[event.displayLevel] }]}>
        <Avatar uri={event.sender.avatarUrl ?? null} size={34} />
        <View style={styles.texts}>
          <Text size={13} weight={600} lineHeight={16} color={colors.white} numberOfLines={1}>
            {event.sender.name}
          </Text>
          <Text size={11} lineHeight={14} color="rgba(255,255,255,0.85)" numberOfLines={1}>
            sent {banner.giftName}
          </Text>
        </View>
        <View style={styles.giftIcon}>
          <LiveGiftArtwork assetKey={event.animationAssetKey} size={40} />
        </View>
      </View>
      <Animated.View style={{ transform: [{ scale: comboScale }] }}>
        <Text size={26} weight={700} lineHeight={30} color="#FFE14D" style={styles.comboText}>
          ×{banner.comboCount}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

export function LiveGiftBanners({ banners }: { banners: readonly LiveGiftBannerEntry[] }) {
  return (
    <View pointerEvents="none" style={styles.stack}>
      {banners.map((banner) => (
        <LiveGiftBanner key={banner.comboKey} banner={banner} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8, alignItems: "flex-start" },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 3, paddingRight: 48, paddingVertical: 3, borderRadius: 999, maxWidth: 230 },
  texts: { flexShrink: 1, minWidth: 70 },
  giftIcon: { position: "absolute", right: 4, top: -6 },
  comboText: { fontStyle: "italic", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
