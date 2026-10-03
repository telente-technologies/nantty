import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavigationTheme } from "@react-navigation/native";
import { useMemo } from "react";

import { GuestAuthReplayCoordinator } from "@/components/auth/guestAuthReplay";
import { GuestAuthSheet } from "@/components/auth/guestAuthSheet";
import { useAuthStore } from "@/store/auth.store";
import { useGuestSessionStore } from "@/store/guestSession.store";
import { useTheme } from "@/theme";

import { AuthNavigator } from "./auth.navigator";
import { MainNavigator } from "./main.navigator";
import { rootNavigationRef } from "./navigationRef";

function useNavigationThemeFollowingAppTheme(): NavigationTheme {
  const { colors, isDark } = useTheme();
  return useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return isDark
      ? {
          ...base,
          colors: { ...base.colors, background: colors.background, primary: colors.primary, card: colors.surface, text: colors.text, border: colors.divider, notification: colors.error },
        }
      : { ...base, colors: { ...base.colors, background: colors.background, primary: colors.primary } };
  }, [colors, isDark]);
}

export function RootNavigator() {
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  const isBrowsingAsGuest = useGuestSessionStore((s) => s.isBrowsingAsGuest);
  const canShowMainApp = isSignedIn || isBrowsingAsGuest;
  const navigationTheme = useNavigationThemeFollowingAppTheme();
  return (
    <NavigationContainer ref={rootNavigationRef} theme={navigationTheme}>
      {canShowMainApp ? <MainNavigator /> : <AuthNavigator />}
      <GuestAuthReplayCoordinator />
      <GuestAuthSheet />
    </NavigationContainer>
  );
}
