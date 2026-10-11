import { useState } from "react";
import { scheduleOnRN } from "react-native-worklets";

import { useKeyboardHandler } from "@/components/ui/keyboardController";

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
