import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

import { LiveGiftArtwork } from "./liveGiftArtwork";
import { findLiveGiftArtworkPreset } from "./liveGiftArtworkPresets.constant";
import type { LiveGiftAnimationEntry } from "./liveGiftOverlayQueues.hook";
import { LiveGiftStaticCard } from "./liveGiftStaticCard";
import { LiveGiftLightRays, LiveGiftOrbitRing, LiveGiftParticleBurst } from "./liveGiftParticles";
import { liveGlass } from "../liveSurface.constant";

export interface LiveGiftSpotlightProps {
  readonly entry: LiveGiftAnimationEntry;
  readonly streamerUsername: string | null;
  readonly onFinished: () => void;
}

export function LiveGiftSpotlight(props: LiveGiftSpotlightProps) {
  const reducedMotion = useReducedMotionPreference();
  return reducedMotion ? <LiveGiftStaticCard {...props} /> : <AnimatedLiveGiftSpotlight {...props} />;
}

function AnimatedLiveGiftSpotlight({ entry, streamerUsername, onFinished }: LiveGiftSpotlightProps) {
  const { width } = useWindowDimensions();
  const { event } = entry;
  const isGlobal = entry.mode === "global";
  const accent = findLiveGiftArtworkPreset(event.animationAssetKey).accent;
  const timeline = useRef(new Animated.Value(0)).current;
  const particles = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6_000, easing: Easing.linear, useNativeDriver: true }));
    spinLoop.start();
    Animated.parallel([
      Animated.timing(timeline, { toValue: 1, duration: entry.durationMs, easing: Easing.linear, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(entry.durationMs * 0.15),
        Animated.timing(particles, { toValue: 1, duration: entry.durationMs * 0.55, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      spinLoop.stop();
      if (finished) onFinished();
    });
    return () => spinLoop.stop();
  }, [entry.durationMs, onFinished, particles, spin, timeline]);

  const artworkSize = Math.min(isGlobal ? 260 : 220, width * (isGlobal ? 0.68 : 0.58));
  const scale = timeline.interpolate({ inputRange: [0, 0.12, 0.2, 0.85, 1], outputRange: [0.2, 1.15, 1, 1.05, 0.7] });
  const opacity = timeline.interpolate({ inputRange: [0, 0.06, 0.88, 1], outputRange: [0, 1, 1, 0] });
  const float = timeline.interpolate({ inputRange: [0, 0.5, 1], outputRange: [20, -6, -24] });
  const ringScale = timeline.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1, 1.15] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]} accessibilityLiveRegion="polite" accessibilityLabel={`${event.sender.name} sent ${entry.giftName}`}>
      <Animated.View style={[StyleSheet.absoluteFill, isGlobal ? styles.globalTint : styles.largeDim, { opacity }]} />
      {isGlobal ? (
        <Animated.View style={[styles.marquee, { opacity }]}>
          <Text size={12} weight={700} lineHeight={16} color="#FFE14D" letterSpacing={1.5}>
            LEGENDARY GIFT
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.center, { opacity, transform: [{ translateY: float }] }]}>
        <Animated.View style={[styles.layer, { transform: [{ rotate }, { scale: ringScale }] }]}>
          <LiveGiftLightRays size={artworkSize * 2.2} color={accent} />
        </Animated.View>
        <LiveGiftParticleBurst progress={particles} assetKey={event.animationAssetKey} count={isGlobal ? 26 : 18} distance={artworkSize * 1.05} />
        <Animated.View style={{ transform: [{ scale }] }}>
          <LiveGiftArtwork assetKey={event.animationAssetKey} size={artworkSize} />
        </Animated.View>
        <Animated.View style={[styles.layer, { top: artworkSize * 0.64, transform: [{ scale: ringScale }] }]}>
          <LiveGiftOrbitRing width={artworkSize * 1.3} color="#FFD34D" />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.caption, { opacity }]}>
        <Text size={isGlobal ? 18 : 16} weight={700} lineHeight={22} color={liveGlass.ink} align="center" numberOfLines={1} style={styles.shadow}>
          {event.sender.name}
        </Text>
        <Text size={13} weight={600} lineHeight={17} color="#FFE14D" align="center" style={styles.shadow}>
          sent {entry.giftName}
          {event.comboCount > 1 ? ` ×${event.comboCount}` : ""}
          {isGlobal && streamerUsername ? ` to @${streamerUsername}` : ""}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  largeDim: { backgroundColor: "rgba(10,0,30,0.35)" },
  globalTint: { backgroundColor: "rgba(60,0,90,0.12)" },
  marquee: { position: "absolute", top: 120, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, backgroundColor: liveGlass.background, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border },
  layer: { position: "absolute" },
  caption: { marginTop: 28, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, backgroundColor: liveGlass.background, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, maxWidth: "84%" },
  shadow: { textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
});
