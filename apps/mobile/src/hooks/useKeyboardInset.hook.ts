import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, type LayoutChangeEvent } from "react-native";

const RESIZE_DETECTION_RATIO = 0.6;

export interface KeyboardInset {
  readonly inset: number;
  readonly handleLayout: (event: LayoutChangeEvent) => void;
}

export function useKeyboardInset(): KeyboardInset {
  const [inset, setInset] = useState(0);
  const baselineHeight = useRef<number | null>(null);
  const currentHeight = useRef<number | null>(null);
  const keyboardHeight = useRef(0);

  const evaluate = (containerHeight: number | null) => {
    const keyboard = keyboardHeight.current;
    if (keyboard <= 0) {
      setInset(0);
      return;
    }
    const baseline = baselineHeight.current;
    if (baseline === null || containerHeight === null) {
      setInset(keyboard);
      return;
    }
    const windowAlreadyShrank = containerHeight <= baseline - keyboard * RESIZE_DETECTION_RATIO;
    setInset(windowAlreadyShrank ? 0 : keyboard);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    currentHeight.current = height;
    if (keyboardHeight.current <= 0) baselineHeight.current = height;
    evaluate(height);
  };

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      keyboardHeight.current = event.endCoordinates.height;
      evaluate(currentHeight.current);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.current = 0;
      setInset(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return { inset, handleLayout };
}
