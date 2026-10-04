"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, type ThemePreference } from "@zudomart/web-kit";
import { Suspense, useCallback, useState, type ReactNode } from "react";

import { isRetryableApiFailure, sendRequestToWebappServer } from "@/services/clientApi.service";

import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { CelebrationHost } from "@/components/celebrations/celebrationHost";
import { AuthPromptModal } from "@/components/auth/authPromptModal";
import { ConfirmDialogHost } from "@/components/ui/confirmDialog";
import { ToastViewport } from "@/components/ui/toast";

import { SessionProvider } from "./sessionProvider";
import type { User } from "@/types";

interface AppProvidersProps {
  readonly viewer: User | null;
  readonly csrfToken: string | null;
  readonly themePreference: ThemePreference;
  readonly children: ReactNode;
}

export function AppProviders({ viewer, csrfToken, themePreference, children }: AppProvidersProps) {
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

  const isSignedIn = viewer !== null;
  const saveThemePreferenceToProfile = useCallback(
    async (theme: ThemePreference) => {
      if (!isSignedIn) return;
      await sendRequestToWebappServer<void>("/api/v1/users/me/preferences", { method: "PATCH", body: { theme } });
    },
    [isSignedIn],
  );

  return (
    <ThemeProvider initialPreference={themePreference} onPreferenceChange={saveThemePreferenceToProfile}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider viewer={viewer} csrfToken={csrfToken}>
          {children}
          <ConsentBannerHost />
          <ToastViewport />
          <ConfirmDialogHost />
          <CelebrationHost />
          <Suspense fallback={null}>
            <AuthPromptModal />
          </Suspense>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
