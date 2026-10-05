"use client";

import { useCallback, type ReactNode } from "react";

import { ThemeProvider, type ThemePreference } from "@zudomart/web-kit";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { sendSellerApiRequest } from "@/services/clientApi.service";

export function AppThemeProvider({ initialPreference, children }: { readonly initialPreference: ThemePreference; readonly children: ReactNode }) {
  const { sessionView } = useSellerSession();
  const isSignedIn = sessionView !== null;
  const saveThemePreferenceToProfile = useCallback(
    async (theme: ThemePreference) => {
      if (!isSignedIn) return;
      await sendSellerApiRequest<void>("/users/me/preferences", { method: "PATCH", body: { theme } });
    },
    [isSignedIn],
  );
  return (
    <ThemeProvider initialPreference={initialPreference} onPreferenceChange={saveThemePreferenceToProfile}>
      {children}
    </ThemeProvider>
  );
}
