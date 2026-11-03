"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isThemePreference, ThemeProvider, themeChangedEventName, useTheme, type ThemePreference } from "@nantty/web-kit";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { isRetryableApiFailure, sendRequestToWebappServer } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";

import { WebappErrorExperienceProvider } from "@/components/errors/errorExperience.provider";
import { ConsentBannerHost } from "@/components/privacy/consentBannerHost";
import { CelebrationHost } from "@/components/celebrations/celebrationHost";
import { AuthPromptModal } from "@/components/auth/authPromptModal";
import { HumanVerificationDialog } from "@/components/security/humanVerificationDialog";
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

function AccountThemePreferenceHydrator({ viewerId, markPreferenceAsHydrated }: { readonly viewerId: string; readonly markPreferenceAsHydrated: (preference: ThemePreference) => void }) {
  const { setPreference } = useTheme();
  const localChoiceVersionRef = useRef(0);

  const applyAccountPreference = useCallback((preference: ThemePreference) => {
    markPreferenceAsHydrated(preference);
    setPreference(preference);
  }, [markPreferenceAsHydrated, setPreference]);

  useEffect(() => {
    let active = true;
    const choiceVersionAtRequest = localChoiceVersionRef.current;
    const recordLocalChoice = () => { localChoiceVersionRef.current += 1; };
    window.addEventListener(themeChangedEventName, recordLocalChoice);

    void usersService.fetchMyAccountSettings().then((settings) => {
      if (!active || localChoiceVersionRef.current !== choiceVersionAtRequest || !isThemePreference(settings.theme)) return;
      applyAccountPreference(settings.theme);
    }).catch(() => undefined);

    return () => {
      active = false;
      window.removeEventListener(themeChangedEventName, recordLocalChoice);
    };
  }, [applyAccountPreference, viewerId]);

  return null;
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
  const hydratedThemePreferenceRef = useRef<ThemePreference | null>(null);
  const markPreferenceAsHydrated = useCallback((theme: ThemePreference) => {
    hydratedThemePreferenceRef.current = theme;
  }, []);
  const saveThemePreferenceToProfile = useCallback(
    async (theme: ThemePreference) => {
      if (hydratedThemePreferenceRef.current === theme) {
        hydratedThemePreferenceRef.current = null;
        return;
      }
      if (!isSignedIn) return;
      await sendRequestToWebappServer<void>("/api/v1/users/me/preferences", { method: "PATCH", body: { theme } });
    },
    [isSignedIn],
  );

  return (
    <ThemeProvider initialPreference={themePreference} onPreferenceChange={saveThemePreferenceToProfile}>
      {viewer?.id ? <AccountThemePreferenceHydrator viewerId={viewer.id} markPreferenceAsHydrated={markPreferenceAsHydrated} /> : null}
      <QueryClientProvider client={queryClient}>
        <SessionProvider viewer={viewer} csrfToken={csrfToken}>
          <WebappErrorExperienceProvider>{children}</WebappErrorExperienceProvider>
          <ConsentBannerHost />
          <ToastViewport />
          <ConfirmDialogHost />
          <CelebrationHost />
          <Suspense fallback={null}>
            <AuthPromptModal />
          </Suspense>
          <HumanVerificationDialog />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
