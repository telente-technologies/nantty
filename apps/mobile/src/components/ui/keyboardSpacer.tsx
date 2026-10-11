import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { keyboardControllerIsNative, useKeyboardAnimation, useKeyboardHandler } from "./keyboardController";
import { fallbackLiftsLayoutItself } from "./keyboardControllerFallback";

const spacerLiftsForKeyboard = keyboardControllerIsNative || fallbackLiftsLayoutItself();

export interface KeyboardSpacerProps {
  readonly restingHeight?: number;
  readonly openedGap?: number;
  readonly offset?: number;
  readonly reservedHeight?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}

export function KeyboardSpacer({ restingHeight, openedGap = 0, offset = 0, reservedHeight = 0, style, children }: KeyboardSpacerProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, progress } = useKeyboardAnimation();
  const snappedHeight = useSharedValue(0);
  const resting = restingHeight ?? insets.bottom;

  useKeyboardHandler(
    {
      onStart: (event) => {
        "worklet";
        snappedHeight.value = event.height;
      },
      onEnd: (event) => {
        "worklet";
        snappedHeight.value = event.height;
      },
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const keyboard = reduceMotion ? (spacerLiftsForKeyboard ? snappedHeight.value : 0) : Math.abs(height.value);
    const openness = reduceMotion ? (snappedHeight.value > 0 ? 1 : 0) : progress.value;
    const lifted = Math.max(keyboard - offset, 0) + openedGap * openness;
    return { height: Math.max(lifted, resting, reservedHeight) };
  }, [reduceMotion, resting, offset, openedGap, reservedHeight]);

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
