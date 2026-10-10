import { useEffect, useState } from "react";

import { SocialSignInCancelledError, type SocialSignInProvider } from "@/errors/socialSignIn.error";
import { checkIfAppleSignInIsAvailableOnThisDevice } from "@/services/auth/appleSignIn.service";
import { authService } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";

export function useSocialSignIn() {
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const [providerSigningIn, setProviderSigningIn] = useState<SocialSignInProvider | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const saveSignedInSession = useAuthStore((s) => s.saveSignedInSession);

  useEffect(() => {
    let isMounted = true;
    checkIfAppleSignInIsAvailableOnThisDevice().then((isAvailable) => {
      if (isMounted) setIsAppleSignInAvailable(isAvailable);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const signInWithProvider = async (provider: SocialSignInProvider) => {
    if (providerSigningIn) return;
    setFailureMessage(null);
    setProviderSigningIn(provider);
    try {
      await saveSignedInSession(await authService.signInWithSocialProvider(provider));
    } catch (error) {
      if (!(error instanceof SocialSignInCancelledError)) setFailureMessage(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setProviderSigningIn(null);
    }
  };

  return { isAppleSignInAvailable, providerSigningIn, failureMessage, signInWithProvider };
}
