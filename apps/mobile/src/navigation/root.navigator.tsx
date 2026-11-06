import { DarkTheme, DefaultTheme, NavigationContainer, type NavigationState, type PartialState, type Theme as NavigationTheme } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GuestAuthReplayCoordinator } from "@/components/auth/guestAuthReplay";
import { AccountThemePreferenceSync } from "@/components/settings/accountThemePreferenceSync";
import { MediaDownloadHost } from "@/components/downloads/mediaDownloadHost";
import { GuestAuthSheet } from "@/components/auth/guestAuthSheet";
import { PolicyReacceptScreen } from "@/components/legal/policyReacceptScreen";
import { PolicyUpdateBanner } from "@/components/legal/policyUpdateBanner";
import { DialogHost } from "@/components/ui/dialogHost";
import { ToastHost } from "@/components/ui/toastHost";
import { ErrorScreen } from "@/components/ui/errorState";
import { Screen } from "@/components/ui/screen";
import { useAppGateStore } from "@/store/appGate.store";
import { SuspendedAccountScreen } from "@/screens/account/suspendedAccount.screen";
import { usePolicyUpdates } from "@/hooks/usePolicyUpdates.hook";
import { useAuthStore } from "@/store/auth.store";
import { useGuestSessionStore } from "@/store/guestSession.store";
import { useTheme } from "@/theme";
import { clearHandledNotificationResponse, subscribeToNotificationResponses } from "@/services/notificationResponse.service";

import { AuthNavigator } from "./auth.navigator";
import { MainNavigator } from "./main.navigator";
import { deepLinking } from "./linking.config";
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
  const isAccountSuspended = useAuthStore((s) => s.status === "signedIn" && s.user?.account?.status === "suspended");
  const navigationTheme = useNavigationThemeFollowingAppTheme();
  const { blocking: blockingPolicyVersion } = usePolicyUpdates();
  const isUpdateRequired = useAppGateStore((s) => s.isUpdateRequired);
  const isReadyForPrivateRoutes = useAuthStore((s) => s.status === "signedIn");
  const [navigationReady, setNavigationReady] = useState(false);
  const pendingNotificationRoute = useRef<PartialState<NavigationState> | null>(null);
  const flushNotificationRoute = useCallback(() => {
    const state = pendingNotificationRoute.current;
    if (!isReadyForPrivateRoutes || !navigationReady || state === null || !rootNavigationRef.isReady()) return;
    pendingNotificationRoute.current = null;
    rootNavigationRef.resetRoot(state);
    void clearHandledNotificationResponse();
  }, [isReadyForPrivateRoutes, navigationReady]);
  const flushNotificationRouteRef = useRef(flushNotificationRoute);
  useEffect(() => {
    flushNotificationRouteRef.current = flushNotificationRoute;
  }, [flushNotificationRoute]);

  useEffect(() => subscribeToNotificationResponses((state) => {
    pendingNotificationRoute.current = state;
    flushNotificationRouteRef.current();
  }), []);

  useEffect(() => {
    flushNotificationRoute();
  }, [flushNotificationRoute]);

  if (isUpdateRequired) {
    return (
      <>
        <Screen>
          <ErrorScreen kind="updateRequired" />
        </Screen>
        <ToastHost />
      </>
    );
  }
  if (isAccountSuspended || blockingPolicyVersion) {
    return (
      <>
        {isAccountSuspended ? <SuspendedAccountScreen /> : blockingPolicyVersion ? <PolicyReacceptScreen version={blockingPolicyVersion} /> : null}
        <DialogHost />
        <ToastHost />
      </>
    );
  }
  return (
    <NavigationContainer
      ref={rootNavigationRef}
      theme={navigationTheme}
      linking={canShowMainApp ? deepLinking : undefined}
      onReady={() => {
        setNavigationReady(true);
        flushNotificationRoute();
      }}
    >
      {canShowMainApp ? <MainNavigator /> : <AuthNavigator />}
      <AccountThemePreferenceSync />
      <GuestAuthReplayCoordinator />
      <GuestAuthSheet />
      <PolicyUpdateBanner />
      {canShowMainApp ? <MediaDownloadHost /> : null}
      <DialogHost />
      <ToastHost />
    </NavigationContainer>
  );
}
