import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme } from "@/theme";

import { liveAccent } from "./liveSurface.constant";

export interface LiveAvatarRingProps {
  readonly size: number;
  readonly borderRadius?: number;
  readonly children: ReactNode;
}

const RING_GAP = 3;
const RING_WIDTH = 2;

function usePulsingRingOpacity(isReducedMotion: boolean) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isReducedMotion) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isReducedMotion, opacity]);
  return opacity;
}

export function LiveAvatarRing({ size, borderRadius, children }: LiveAvatarRingProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotionPreference();
  const ringOpacity = usePulsingRingOpacity(isReducedMotion);
  const outerSize = size + (RING_GAP + RING_WIDTH) * 2;
  const innerRadius = borderRadius ?? size / 2;
  const outerRadius = innerRadius + RING_GAP + RING_WIDTH;
  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: outerRadius, opacity: ringOpacity }]}
      />
      <View style={{ width: size, height: size, borderRadius: innerRadius, overflow: "hidden" }}>{children}</View>
      <View pointerEvents="none" style={[styles.pill, { borderColor: colors.background }]}>
        <Text size={9} weight={700} lineHeight={11} color="#FFFFFF" letterSpacing={0.6}>
          LIVE
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: RING_WIDTH, borderColor: liveAccent.red },
  pill: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: liveAccent.red,
  },
});
