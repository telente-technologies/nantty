"use client";

import { useCallback, type ReactNode } from "react";

import { ThemeProvider, type ThemePreference } from "@nantty/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { sendRequestToStudioServer } from "@/services/clientApi.service";

export function StudioThemeProvider({ initialPreference, children }: { readonly initialPreference: ThemePreference; readonly children: ReactNode }) {
  const { viewer } = useSession();
  const isSignedIn = viewer !== null;
  const saveThemePreferenceToProfile = useCallback(
    (theme: ThemePreference) => (isSignedIn ? sendRequestToStudioServer<void>("/api/v1/users/me/preferences", { method: "PATCH", body: { theme } }) : undefined),
    [isSignedIn],
  );
  return (
    <ThemeProvider initialPreference={initialPreference} onPreferenceChange={saveThemePreferenceToProfile}>
      {children}
    </ThemeProvider>
  );
}
