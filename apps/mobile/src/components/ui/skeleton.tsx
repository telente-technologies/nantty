import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/constants/colors.constant";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

export interface SkeletonProps {
  readonly width?: DimensionValue;
  readonly height?: number;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = "100%", height = 14, radius = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotionPreference();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity }, style]}
    />
  );
}
