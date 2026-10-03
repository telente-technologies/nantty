import { rootNavigationRef } from "@/navigation/navigationRef";
import { useAuthStore } from "@/store/auth.store";
import { usePendingAuthIntentStore, type ReturnTarget } from "@/store/pendingAuthIntent.store";

export type { ReturnTarget };

export const isViewerSignedIn = () => useAuthStore.getState().status === "signedIn";

export function readFocusedRouteAsReturnTarget(): ReturnTarget | null {
  if (!rootNavigationRef.isReady()) return null;
  const route = rootNavigationRef.getCurrentRoute();
  return route ? { name: route.name, params: route.params } : null;
}

export function requireAuthThen(action: () => void | Promise<void>, returnTo?: ReturnTarget | null, reason = "continue"): boolean {
  if (isViewerSignedIn()) {
    void action();
    return true;
  }
  const intents = usePendingAuthIntentStore.getState();
  intents.rememberPendingIntent({ action, returnTo: returnTo ?? readFocusedRouteAsReturnTarget() });
  intents.openSignInPrompt(reason);
  return false;
}

export function openAuthFlowThenReturn(mode: "signup" | "login") {
  const intents = usePendingAuthIntentStore.getState();
  if (!intents.pendingIntent) intents.rememberPendingIntent({ action: null, returnTo: readFocusedRouteAsReturnTarget() });
  intents.closeSignInPrompt();
  if (rootNavigationRef.isReady()) rootNavigationRef.navigate("AuthFlow", { mode });
}

const MODAL_DISMISS_ANIMATION_MS = 400;

export function requireAuthAfterClosingModal(closeModal: () => void, action: () => void | Promise<void>, reason?: string): boolean {
  if (isViewerSignedIn()) {
    void action();
    return true;
  }
  const returnTo = readFocusedRouteAsReturnTarget();
  closeModal();
  setTimeout(() => requireAuthThen(action, returnTo, reason), MODAL_DISMISS_ANIMATION_MS);
  return false;
}
