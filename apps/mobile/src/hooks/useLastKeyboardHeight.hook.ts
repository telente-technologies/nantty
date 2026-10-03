import { useState } from "react";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { scheduleOnRN } from "react-native-worklets";

const FALLBACK_KEYBOARD_HEIGHT = 300;
let lastKnownKeyboardHeight = FALLBACK_KEYBOARD_HEIGHT;

export function useLastKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(lastKnownKeyboardHeight);
  const remember = (height: number) => {
    lastKnownKeyboardHeight = height;
    setKeyboardHeight(height);
  };
  useKeyboardHandler(
    {
      onEnd: (event) => {
        "worklet";
        if (event.height > 0) scheduleOnRN(remember, event.height);
      },
    },
    [],
  );
  return keyboardHeight;
}
