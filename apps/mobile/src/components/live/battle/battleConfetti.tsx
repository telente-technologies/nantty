import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

const CONFETTI_COLORS = ["#FFD54A", "#FF2D6F", "#2D7CFF", "#10B981", "#FFFFFF", "#F59E0B"];
const CONFETTI_PIECE_COUNT = 28;
const CONFETTI_FALL_MS = 2_600;

export function BattleConfetti({ burstKey, height }: { burstKey: string; height: number }) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECE_COUNT }, (_, index) => ({
        leftPercent: (index * 37) % 100,
        delayShare: ((index * 13) % 10) / 25,
        drift: ((index % 5) - 2) * 14,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]!,
        size: 6 + (index % 3) * 2,
      })),
    [],
  );
  useEffect(() => {
    if (reducedMotion) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: CONFETTI_FALL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [burstKey, progress, reducedMotion]);
  if (reducedMotion) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, index) => {
        const start = piece.delayShare;
        const translateY = progress.interpolate({ inputRange: [0, start, 1], outputRange: [-20, -20, height], extrapolate: "clamp" });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${360 + index * 40}deg`] });
        const opacity = progress.interpolate({ inputRange: [0, start, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={index}
            style={[
              styles.piece,
              { left: `${piece.leftPercent}%`, width: piece.size, height: piece.size * 1.6, backgroundColor: piece.color, opacity },
              { transform: [{ translateY }, { translateX }, { rotate }] },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute", top: 0, borderRadius: 2 },
});
