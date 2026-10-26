"use client";

import { useCallback, type ReactNode } from "react";

import { ThemeProvider, type ThemePreference } from "@nantty/web-kit";

import { sendAdminApiRequest } from "@/services/adminApiClient.service";

interface AppThemeProviderProps {
  readonly children: ReactNode;
  readonly initialPreference: ThemePreference;
  readonly isSignedIn: boolean;
}

export function AppThemeProvider({ children, initialPreference, isSignedIn }: AppThemeProviderProps) {
  const saveThemePreferenceToProfile = useCallback(
    async (theme: ThemePreference) => {
      if (!isSignedIn) return;
      await sendAdminApiRequest<void>("/admin/users/me/preferences", { method: "PATCH", body: { theme }, promptForStepUp: false });
    },
    [isSignedIn],
  );
  return (
    <ThemeProvider initialPreference={initialPreference} onPreferenceChange={saveThemePreferenceToProfile}>
      {children}
    </ThemeProvider>
  );
}
