import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme } from "@/theme";

import { BalloonShape } from "./balloonShape";
import { CelebrationConfetti } from "./celebrationConfetti";

export interface FloatingBalloonsProps {
  readonly count?: number;
  readonly height: number;
  readonly style?: StyleProp<ViewStyle>;
}

interface BalloonSpec {
  readonly id: number;
  readonly left: number;
  readonly size: number;
  readonly delay: number;
  readonly duration: number;
  readonly tone: number;
}

const buildSpecs = (count: number): BalloonSpec[] =>
  Array.from({ length: count }, (_, id) => ({ id, left: 4 + ((id * 83) % 88), size: 34 + ((id * 7) % 4) * 6, delay: id * 260, duration: 5200 + ((id * 610) % 2400), tone: id % 4 }));

function Balloon({ spec, height, color, onPop }: { spec: BalloonSpec; height: number; color: string; onPop: (id: number) => void }) {
  const rise = useSharedValue(0);
  const sway = useSharedValue(0);
  const pop = useSharedValue(1);
  useEffect(() => {
    rise.value = withDelay(spec.delay, withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.quad) }), -1, false));
    sway.value = withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(-1, { duration: 1400 })), -1, true);
  }, [rise, sway, spec]);
  const animated = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ translateY: height - rise.value * (height + spec.size * 2) }, { translateX: sway.value * 8 }, { scale: pop.value === 1 ? 1 : 1 + (1 - pop.value) * 0.8 }],
  }));
  const burst = () => {
    pop.set(withTiming(0, { duration: 160 }));
    setTimeout(() => onPop(spec.id), 170);
  };
  return (
    <Animated.View style={[styles.balloon, { left: `${spec.left}%` }, animated]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pop balloon" hitSlop={8} onPress={burst}>
        <BalloonShape color={color} size={spec.size} />
      </Pressable>
    </Animated.View>
  );
}

export function FloatingBalloons({ count = 7, height, style }: FloatingBalloonsProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const specs = useMemo(() => buildSpecs(count), [count]);
  const [popped, setPopped] = useState<ReadonlySet<number>>(new Set());
  const tones = [colors.primary, colors.success, colors.caution, colors.error];
  if (reduceMotion) {
    return (
      <View style={[styles.layer, { height }, style]} pointerEvents="none">
        <CelebrationConfetti height={Math.min(height, 90)} />
      </View>
    );
  }
  return (
    <View style={[styles.layer, { height }, style]} pointerEvents="box-none">
      {specs.filter((spec) => !popped.has(spec.id)).map((spec) => (
        <Balloon key={spec.id} spec={spec} height={height} color={tones[spec.tone]!} onPop={(id) => setPopped((current) => new Set(current).add(id))} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  balloon: { position: "absolute", top: 0 },
});
