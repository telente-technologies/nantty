import { StackActions } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { refreshTrackingConsents } from "@/services/sellers/productInteractions.service";
import { rootNavigationRef } from "@/navigation/navigationRef";
import { useAuthStore } from "@/store/auth.store";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";

const REPLAY_DELAY_AFTER_NAVIGATION_MS = 350;

const closeAuthFlowIfOpen = () => {
  if (!rootNavigationRef.isReady()) return;
  const rootState = rootNavigationRef.getRootState();
  if (!rootState) return;
  const topRoute = rootState.routes[rootState.index];
  if (topRoute?.name === "AuthFlow") rootNavigationRef.dispatch({ ...StackActions.pop(), target: rootState.key });
};

export function GuestAuthReplayCoordinator() {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  const wasSignedIn = useRef(isSignedIn);

  useEffect(() => {
    const justSignedIn = isSignedIn && !wasSignedIn.current;
    wasSignedIn.current = isSignedIn;
    if (!justSignedIn) return;
    const { takePendingIntent, closeSignInPrompt } = usePendingAuthIntentStore.getState();
    closeSignInPrompt();
    const intent = takePendingIntent();
    closeAuthFlowIfOpen();
    queryClient.invalidateQueries();
    refreshTrackingConsents();
    if (!intent) return;
    const { returnTo, action } = intent;
    const timer = setTimeout(() => {
      const current = rootNavigationRef.isReady() ? rootNavigationRef.getCurrentRoute() : null;
      if (returnTo && current && current.name !== returnTo.name) (rootNavigationRef.navigate as (name: string, params?: object) => void)(returnTo.name, returnTo.params);
      Promise.resolve(action?.()).catch(() => undefined);
    }, REPLAY_DELAY_AFTER_NAVIGATION_MS);
    return () => clearTimeout(timer);
  }, [isSignedIn, queryClient]);

  return null;
}
