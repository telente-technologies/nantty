"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { isRetryableApiFailure } from "@/services/clientApi.service";

import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { StudioThemeProvider } from "@/components/theme/studioThemeProvider";
import { ConfirmDialogHost, type ThemePreference } from "@zudomart/web-kit";

import { StudioErrorExperienceProvider } from "@/components/errors/errorExperience.provider";

import { SessionProvider } from "./sessionProvider";
import type { User } from "@/types";

export function AppProviders({ viewer, csrfToken, themePreference, children }: { readonly viewer: User | null; readonly csrfToken: string | null; readonly themePreference: ThemePreference; readonly children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => failureCount < 2 && isRetryableApiFailure(error),
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider viewer={viewer} csrfToken={csrfToken}>
        <StudioThemeProvider initialPreference={themePreference}>
          <StudioErrorExperienceProvider>{children}</StudioErrorExperienceProvider>
          <ConfirmDialogHost />
          <ConsentBannerHost />
        </StudioThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
