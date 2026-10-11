import type { ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardAnimation } from "./keyboardController";
import { KeyboardSpacer } from "./keyboardSpacer";

export interface KeyboardStickyFooterProps {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly backgroundColor?: string;
  readonly safeAreaHandledByParent?: boolean;
  readonly offset?: number;
  readonly openedGap?: number;
}

export function keyboardLiftDistance(bottomInset: number, safeAreaHandledByParent: boolean, offset: number): { readonly resting: number; readonly below: number } {
  return safeAreaHandledByParent ? { resting: 0, below: bottomInset + offset } : { resting: bottomInset, below: offset };
}

export function KeyboardStickyFooter({ children, style, backgroundColor, safeAreaHandledByParent = false, offset = 0, openedGap = 0 }: KeyboardStickyFooterProps) {
  const insets = useSafeAreaInsets();
  const lift = keyboardLiftDistance(insets.bottom, safeAreaHandledByParent, offset);
  const background = backgroundColor ? { backgroundColor } : null;
  return (
    <View style={background}>
      <View style={style}>{children}</View>
      <KeyboardSpacer restingHeight={lift.resting} offset={lift.below} openedGap={openedGap} style={background} />
    </View>
  );
}

export interface KeyboardFloatingFooterProps {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly safeAreaHandledByParent?: boolean;
  readonly offset?: number;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

export function KeyboardFloatingFooter({ children, style, safeAreaHandledByParent = false, offset = 0, onLayout }: KeyboardFloatingFooterProps) {
  const insets = useSafeAreaInsets();
  const { height } = useKeyboardAnimation();
  const { resting: restingInset, below } = keyboardLiftDistance(insets.bottom, safeAreaHandledByParent, offset);
  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: -Math.max(Math.abs(height.value) - below - restingInset, 0) }] }),
    [below, restingInset],
  );
  return (
    <Animated.View onLayout={onLayout} style={[style, { paddingBottom: restingInset }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
