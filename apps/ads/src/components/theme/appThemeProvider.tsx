"use client";

import type { ReactNode } from "react";

import { ThemeProvider, type ThemePreference } from "@zudomart/web-kit";

import { sendAdsApiRequest } from "@/services/adsApiClient.service";

function saveThemePreferenceToProfile(theme: ThemePreference): Promise<void> {
  return sendAdsApiRequest<void>("/users/me/preferences", { method: "PATCH", body: { theme } });
}

export function AppThemeProvider({ initialPreference, isSignedIn, children }: { readonly initialPreference: ThemePreference; readonly isSignedIn: boolean; readonly children: ReactNode }) {
  return (
    <ThemeProvider initialPreference={initialPreference} onPreferenceChange={isSignedIn ? saveThemePreferenceToProfile : undefined}>
      {children}
    </ThemeProvider>
  );
}
