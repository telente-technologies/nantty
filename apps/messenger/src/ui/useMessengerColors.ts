import { useColorScheme } from "react-native";

import { messengerTheme } from "../theme";

export function useMessengerColors() {
  return useColorScheme() === "dark" ? messengerTheme.dark : messengerTheme.light;
}
