import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

import { HeartFill72Icon } from "@/components/icons";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

export function LikeBurst({ burstKey }: { burstKey: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    if (burstKey === 0) return;
    scale.setValue(reducedMotion ? 1 : 0.4);
    opacity.setValue(1);
    Animated.sequence([
      reducedMotion ? Animated.delay(0) : Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true }),
    ]).start();
  }, [burstKey, opacity, reducedMotion, scale]);

  return (
    <Animated.View pointerEvents="none" style={[styles.center, { opacity, transform: [{ scale }] }]}>
      <HeartFill72Icon />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
});
