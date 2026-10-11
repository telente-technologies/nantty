import { useEffect, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DotsThreeVertical24Icon, Heart24Icon, PauseFill24Icon, Speedometer24Icon } from "@/components/icons";
import { ArrowClockwiseIcon, ArrowDownIcon, ArrowUpIcon, HandPointingIcon, SlidersHorizontalIcon } from "@/components/icons/phosphorGlyphs";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useTheme } from "@/theme";

const INK_ON_SCRIM = colors.white;
const MUTED_INK_ON_SCRIM = "rgba(255,255,255,0.72)";
const HAND_TRAVEL = 28;

function SwipeGlyph({ direction }: { direction: "up" | "down" }) {
  const Arrow = direction === "down" ? ArrowDownIcon : ArrowUpIcon;
  return <Arrow size={24} weight="bold" color={INK_ON_SCRIM} />;
}

function HandGlyph() {
  return <HandPointingIcon size={48} weight="bold" color={INK_ON_SCRIM} />;
}

const TIPS: readonly { readonly title: string; readonly hint: string; readonly glyph: ReactNode }[] = [
  { title: "Next clip", hint: "Swipe up", glyph: <SwipeGlyph direction="up" /> },
  { title: "Previous clip", hint: "Swipe down", glyph: <SwipeGlyph direction="down" /> },
  { title: "Pause or play", hint: "Tap once", glyph: <PauseFill24Icon color={INK_ON_SCRIM} /> },
  { title: "Like", hint: "Double-tap the middle", glyph: <Heart24Icon color={INK_ON_SCRIM} /> },
  { title: "Skip back or ahead 10s", hint: "Double-tap the left or right side. Keep tapping to skip more", glyph: <ArrowClockwiseIcon size={24} weight="bold" color={INK_ON_SCRIM} /> },
  { title: "Jump to any moment", hint: "Drag the bar at the bottom of the clip", glyph: <SlidersHorizontalIcon size={24} weight="bold" color={INK_ON_SCRIM} /> },
  { title: "Play at 2×", hint: "Press and hold", glyph: <Speedometer24Icon color={INK_ON_SCRIM} /> },
  { title: "More options", hint: "Tap the three-dot button beside the clip", glyph: <DotsThreeVertical24Icon color={INK_ON_SCRIM} /> },
];

function AnimatedSwipeHand() {
  const reduceMotion = useReducedMotion();
  const travel = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    travel.value = withRepeat(
      withSequence(withTiming(-HAND_TRAVEL, { duration: 700, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })),
      -1,
    );
    return () => cancelAnimation(travel);
  }, [reduceMotion, travel]);
  const handStyle = useAnimatedStyle(() => ({ transform: [{ translateY: travel.value }], opacity: 1 + travel.value / (HAND_TRAVEL * 3) }));
  return (
    <View style={styles.hero} importantForAccessibility="no-hide-descendants">
      <SwipeGlyph direction="up" />
      <Animated.View style={handStyle}>
        <HandGlyph />
      </Animated.View>
    </View>
  );
}

export function GestureTipsOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Clip gestures. Swipe up for the next clip, swipe down for the previous one, tap to pause, double-tap the middle to like, double-tap the left or right side to skip 10 seconds, drag the bar at the bottom to jump to any moment, press and hold to play at double speed, and use the more button for options. Tap to dismiss."
      onPress={onDismiss}
      style={[styles.scrim, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
    >
      <AnimatedSwipeHand />
      <Text size={18} weight={600} lineHeight={22} color={INK_ON_SCRIM} align="center" accessibilityRole="header">
        How clips work
      </Text>
      <ScrollView style={styles.tipsScroller} contentContainerStyle={styles.tips} showsVerticalScrollIndicator={false}>
        {TIPS.map((tip) => (
          <View key={tip.title} style={styles.tip}>
            <View style={styles.glyph}>{tip.glyph}</View>
            <View style={styles.tipText}>
              <Text size={14} weight={600} lineHeight={18} color={INK_ON_SCRIM}>
                {tip.title}
              </Text>
              <Text size={13} lineHeight={17} color={MUTED_INK_ON_SCRIM}>
                {tip.hint}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Got it" onPress={onDismiss} style={[styles.gotIt, { backgroundColor: themeColors.primarySolid }]}>
        <Text size={15} weight={600} lineHeight={18} color={themeColors.onPrimary}>
          Got it
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 },
  hero: { height: 96, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  tipsScroller: { alignSelf: "stretch", flexGrow: 0, flexShrink: 1 },
  tips: { gap: 16 },
  tip: { flexDirection: "row", alignItems: "center", gap: 14 },
  glyph: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  tipText: { flex: 1, gap: 2 },
  gotIt: { alignSelf: "stretch", height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
