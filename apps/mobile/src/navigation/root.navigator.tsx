import { DefaultTheme, NavigationContainer } from "@react-navigation/native";

import { colors } from "@/constants/colors.constant";
import { useAuthStore } from "@/store/auth.store";

import { AuthNavigator } from "./auth.navigator";
import { MainNavigator } from "./main.navigator";

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } };

export function RootNavigator() {
  const signedIn = useAuthStore((s) => s.status === "signedIn");
  return <NavigationContainer theme={theme}>{signedIn ? <MainNavigator /> : <AuthNavigator />}</NavigationContainer>;
}
