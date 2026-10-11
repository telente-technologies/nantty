import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { ZudomartLogoMark } from "@/components/brand/zudomartWordmark";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme } from "@/theme";

import { Text } from "./text";

export type BrandLoaderSize = "sm" | "md" | "lg";

export const brandLoaderSizes: Readonly<Record<BrandLoaderSize, number>> = { sm: 24, md: 40, lg: 64 };

const BREATH_MS = 900;

export interface BrandLoaderProps {
  readonly size?: BrandLoaderSize;
  readonly label?: string;
  readonly showLabel?: boolean;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function useBreathingStyle(enabled: boolean) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(progress);
  }, [enabled, progress]);
  return useAnimatedStyle(() => ({ opacity: 1 - progress.value * 0.35, transform: [{ scale: 1 - progress.value * 0.08 }] }));
}

export function BrandLoader({ size = "md", label = "Loading…", showLabel = false, accessibilityLabel, style }: BrandLoaderProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const breathing = useBreathingStyle(!reduceMotion);
  return (
    <View style={[styles.root, style]} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ busy: true }} testID="brand-loader">
      <Animated.View style={reduceMotion ? null : breathing}>
        <ZudomartLogoMark size={brandLoaderSizes[size]} />
      </Animated.View>
      {showLabel ? (
        <Text size={size === "lg" ? 15 : 13} color={colors.textMuted} style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  label: { marginTop: 10 },
});
