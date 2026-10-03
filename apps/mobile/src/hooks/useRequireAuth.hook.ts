import { useCallback } from "react";

import { useAuthStore } from "@/store/auth.store";
import { requireAuthThen, type ReturnTarget } from "@/utils/requireAuth.util";

export function useRequireAuth() {
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  const requireAuth = useCallback(
    (action: () => void | Promise<void>, reason?: string, returnTo?: ReturnTarget) => requireAuthThen(action, returnTo, reason),
    [],
  );
  return { isSignedIn, isGuest: !isSignedIn, requireAuthThen: requireAuth };
}
