"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { rememberCsrfTokenForRequests } from "@/services/adsApiClient.service";
import type { AdsSessionView } from "@/types/session.type";

const AdsSessionContext = createContext<AdsSessionView | null>(null);

export function AdsSessionProvider({ initialSessionView, csrfToken, children }: { readonly initialSessionView: AdsSessionView | null; readonly csrfToken: string | null; readonly children: ReactNode }) {
  rememberCsrfTokenForRequests(csrfToken);
  const sessionView = useMemo(() => initialSessionView, [initialSessionView]);
  return <AdsSessionContext.Provider value={sessionView}>{children}</AdsSessionContext.Provider>;
}

export function useAdsSession(): AdsSessionView | null {
  return useContext(AdsSessionContext);
}
