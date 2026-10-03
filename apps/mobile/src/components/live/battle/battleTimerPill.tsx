import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

import { formatBattleClock } from "./battleClock.hook";
import { liveAccent, liveGlass } from "../liveSurface.constant";

const FINAL_SECONDS = 10;

export function BattleTimerPill({ secondsRemaining, label }: { secondsRemaining: number; label: string }) {
  const reducedMotion = useReducedMotionPreference();
  const pulse = useRef(new Animated.Value(1)).current;
  const isFinalSeconds = secondsRemaining > 0 && secondsRemaining <= FINAL_SECONDS;
  useEffect(() => {
    if (!isFinalSeconds || reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 250, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isFinalSeconds, pulse, reducedMotion]);
  return (
    <Animated.View
      accessibilityLiveRegion={isFinalSeconds ? "assertive" : "none"}
      accessibilityLabel={`${label}, ${secondsRemaining} seconds left`}
      style={[styles.pill, isFinalSeconds ? styles.pillFinal : null, { transform: [{ scale: pulse }] }]}
    >
      <Text size={11} weight={700} lineHeight={14} color={liveGlass.ink}>
        {label} {formatBattleClock(secondsRemaining)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "center", backgroundColor: liveGlass.backgroundStrong, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillFinal: { backgroundColor: liveAccent.red },
});
