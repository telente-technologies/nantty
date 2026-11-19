import { Keyboard, Platform, type ScrollViewProps } from "react-native";

export const KEYBOARD_DISMISS_ON_DRAG: ScrollViewProps["keyboardDismissMode"] =
  Platform.OS === "ios" ? "interactive" : "on-drag";

export function dismissKeyboardIfVisible(): void {
  if (typeof Keyboard.isVisible !== "function" || Keyboard.isVisible()) {
    Keyboard.dismiss();
  }
}

export function dismissKeyboardOnEmptyTap(): boolean {
  dismissKeyboardIfVisible();
  return false;
}
