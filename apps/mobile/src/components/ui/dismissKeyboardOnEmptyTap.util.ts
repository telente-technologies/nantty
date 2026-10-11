import { Keyboard } from "react-native";

export function dismissKeyboardOnEmptyTap(): boolean {
  if (Keyboard.isVisible()) Keyboard.dismiss();
  return false;
}
