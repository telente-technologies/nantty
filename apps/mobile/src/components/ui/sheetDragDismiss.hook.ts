import { useEffect, useMemo, useRef } from "react";
import { PanResponder } from "react-native";
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.9;
const START_SLOP = 6;
const SPRING_BACK = { damping: 20, stiffness: 260, mass: 0.7 } as const;

export function useSheetDragDismiss(visible: boolean, enabled: boolean, onDismiss: () => void) {
  const offset = useSharedValue(0);
  const latest = useRef({ enabled, onDismiss });
  latest.current = { enabled, onDismiss };

  useEffect(() => {
    if (visible) offset.value = 0;
  }, [visible, offset]);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => latest.current.enabled && gesture.dy > START_SLOP && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          offset.value = Math.max(0, gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || (gesture.dy > START_SLOP * 4 && gesture.vy > DISMISS_VELOCITY)) {
            const dismiss = () => latest.current.onDismiss();
            offset.value = withTiming(gesture.dy + 600, { duration: 180 }, (finished) => {
              if (finished) scheduleOnRN(dismiss);
            });
            return;
          }
          offset.value = withSpring(0, SPRING_BACK);
        },
        onPanResponderTerminate: () => {
          offset.value = withSpring(0, SPRING_BACK);
        },
      }).panHandlers,
    [offset],
  );

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return { panHandlers, dragStyle };
}
