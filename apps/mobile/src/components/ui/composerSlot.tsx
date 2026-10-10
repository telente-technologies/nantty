import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";

const SLOT_SWAP_MS = 140;

// Remounts on slotKey change so the send/secondary swap fades in instead of popping.
export function ComposerSlot({ slotKey, style, children }: { slotKey: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View key={slotKey} entering={reduceMotion ? undefined : FadeIn.duration(SLOT_SWAP_MS)} style={style}>
      {children}
    </Animated.View>
  );
}
