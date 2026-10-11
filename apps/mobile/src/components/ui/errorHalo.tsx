import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { ErrorGlyph } from "@/components/icons/errorIcons";
import type { ErrorIconName, ErrorMotion, ErrorTone } from "@/errors/errorExperience/errorKinds";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme, type ThemeColors } from "@/theme";

export function readToneColors(tone: ErrorTone, colors: ThemeColors): { readonly ink: string; readonly tint: string } {
  if (tone === "danger") return { ink: colors.error, tint: colors.errorTint };
  if (tone === "caution") return { ink: colors.cautionText, tint: colors.cautionTint };
  if (tone === "success") return { ink: colors.successText, tint: colors.successTint };
  if (tone === "neutral") return { ink: colors.textMuted, tint: colors.sunken };
  return { ink: colors.primary, tint: colors.primaryTint };
}

function useMotionStyle(motion: ErrorMotion, enabled: boolean) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    if (motion === "glitch") {
      progress.value = withRepeat(withDelay(4200, withSequence(withTiming(1, { duration: 60 }), withTiming(-1, { duration: 60 }), withTiming(0.5, { duration: 60 }), withTiming(0, { duration: 60 }))), -1, false);
    } else {
      progress.value = withRepeat(withTiming(1, { duration: motion === "float" ? 2100 : 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
    return () => cancelAnimation(progress);
  }, [enabled, motion, progress]);
  return useAnimatedStyle(() => {
    if (motion === "glitch") return { transform: [{ translateX: progress.value * 2 }] };
    if (motion === "float") return { transform: [{ translateY: -6 * progress.value }] };
    return { transform: [{ scale: 1 + 0.04 * progress.value }] };
  });
}

export interface ErrorHaloProps {
  readonly icon: ErrorIconName;
  readonly tone: ErrorTone;
  readonly motion: ErrorMotion;
  readonly size: number;
  readonly animated?: boolean;
}

export function ErrorHalo({ icon, tone, motion, size, animated = true }: ErrorHaloProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const enabled = animated && !reduceMotion;
  const motionStyle = useMotionStyle(motion, enabled);
  const { ink, tint } = readToneColors(tone, colors);
  const ring = Math.round(size * 0.14);
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: size + ring * 4, height: size + ring * 4, alignItems: "center", justifyContent: "center" }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: tint, opacity: 0.35 }]} />
      <View style={{ position: "absolute", width: size + ring * 2, height: size + ring * 2, borderRadius: 999, backgroundColor: tint, opacity: 0.7 }} />
      <Animated.View style={[styles.core, { width: size, height: size, backgroundColor: colors.surface, borderColor: tint, shadowColor: ink }, enabled ? motionStyle : null]}>
        <ErrorGlyph name={icon} size={Math.round(size * 0.46)} color={ink} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  core: { borderRadius: 999, borderWidth: 3, alignItems: "center", justifyContent: "center", shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
