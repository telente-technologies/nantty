"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import { rememberCsrfTokenForRequests } from "@/services/clientApi.service";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types";

interface SessionContextValue {
  readonly viewer: User | null;
  readonly csrfToken: string | null;
}

const SessionContext = createContext<SessionContextValue>({ viewer: null, csrfToken: null });

export function SessionProvider({ viewer, csrfToken, children }: SessionContextValue & { readonly children: ReactNode }) {
  const value = useMemo<SessionContextValue>(() => ({ viewer, csrfToken }), [viewer, csrfToken]);
  const syncAuthStore = useAuthStore((state) => state.setViewerFromSession);

  useEffect(() => {
    rememberCsrfTokenForRequests(csrfToken);
    syncAuthStore(viewer);
  }, [csrfToken, viewer, syncAuthStore]);

  useEffect(() => {
    if (!viewer?.id) return;
    const timer = setTimeout(() => void chatCryptoService.ensureReady(viewer.id).catch(() => undefined), 1_500);
    return () => clearTimeout(timer);
  }, [viewer?.id]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
