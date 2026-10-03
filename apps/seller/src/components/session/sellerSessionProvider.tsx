"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { doesAccessGrantPermission, type SellerPermission } from "@/config/rolePermissions.config";
import { rememberCsrfTokenForRequests, sendRequestToDashboardServer } from "@/services/clientApi.service";
import type { SellerSessionView } from "@/types/sellerAccess.type";

interface SellerSessionContextValue {
  readonly sessionView: SellerSessionView | null;
  readonly csrfToken: string | null;
  readonly refreshSessionView: () => Promise<SellerSessionView | null>;
  readonly can: (permission: SellerPermission) => boolean;
}

const SellerSessionContext = createContext<SellerSessionContextValue | null>(null);

export function SellerSessionProvider({ initialSessionView, csrfToken, children }: { initialSessionView: SellerSessionView | null; csrfToken: string | null; children: ReactNode }) {
  rememberCsrfTokenForRequests(csrfToken);
  const [sessionView, setSessionView] = useState(initialSessionView);

  const refreshSessionView = useCallback(async () => {
    const latestSessionView = await sendRequestToDashboardServer<SellerSessionView>("/bff/session").catch(() => null);
    setSessionView(latestSessionView);
    return latestSessionView;
  }, []);

  const contextValue = useMemo<SellerSessionContextValue>(
    () => ({
      sessionView,
      csrfToken,
      refreshSessionView,
      can: (permission) => doesAccessGrantPermission(sessionView?.access, permission),
    }),
    [sessionView, csrfToken, refreshSessionView],
  );
  return <SellerSessionContext.Provider value={contextValue}>{children}</SellerSessionContext.Provider>;
}

export function useSellerSession(): SellerSessionContextValue {
  const contextValue = useContext(SellerSessionContext);
  if (!contextValue) throw new Error("useSellerSession must be used inside SellerSessionProvider.");
  return contextValue;
}
