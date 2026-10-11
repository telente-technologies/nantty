import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon } from "@/components/icons/phosphorGlyphs";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

export interface SeekRippleState {
  readonly zone: "rewind" | "forward";
  readonly seconds: number;
  readonly tapKey: number;
}

export function SeekRipple({ ripple }: { ripple: SeekRippleState | null }) {
  const reducedMotion = useReducedMotionPreference();
  if (!ripple) return null;
  const isRewind = ripple.zone === "rewind";
  const Arrow = isRewind ? ArrowCounterClockwiseIcon : ArrowClockwiseIcon;
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      entering={reducedMotion ? undefined : FadeIn.duration(120)}
      exiting={reducedMotion ? undefined : FadeOut.duration(200)}
      style={[styles.half, isRewind ? styles.left : styles.right]}
    >
      <Animated.View key={ripple.tapKey} entering={reducedMotion ? undefined : ZoomIn.duration(180)} style={styles.badge}>
        <Arrow size={30} weight="bold" color={colors.white} />
        <Text size={14} weight={600} lineHeight={18} color={colors.white}>
          {`${isRewind ? "-" : "+"}${ripple.seconds}s`}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  half: { position: "absolute", top: 0, bottom: 0, width: "38%", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  left: { left: 0, borderTopRightRadius: 9999, borderBottomRightRadius: 9999 },
  right: { right: 0, borderTopLeftRadius: 9999, borderBottomLeftRadius: 9999 },
  badge: { alignItems: "center", gap: 4 },
});
