"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

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
  const value = useMemo<SessionContextValue>(() => {
    rememberCsrfTokenForRequests(csrfToken);
    return { viewer, csrfToken };
  }, [viewer, csrfToken]);
  const syncAuthStore = useAuthStore((state) => state.setViewerFromSession);
  const queryClient = useQueryClient();
  const previousViewerId = useRef(viewer?.id ?? null);

  useEffect(() => {
    const currentViewerId = viewer?.id ?? null;
    if (previousViewerId.current === currentViewerId) return;
    previousViewerId.current = currentViewerId;
    void queryClient.invalidateQueries();
  }, [viewer?.id, queryClient]);

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
