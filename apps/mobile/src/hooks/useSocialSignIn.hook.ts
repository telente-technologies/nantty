import { useEffect, useRef, useState } from "react";

import { SocialSignInCancelledError, type SocialSignInProvider } from "@/errors/socialSignIn.error";
import { checkIfAppleSignInIsAvailableOnThisDevice } from "@/services/auth/appleSignIn.service";
import { authService, type SocialSignInChallenge } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";

export function useSocialSignIn() {
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const [providerSigningIn, setProviderSigningIn] = useState<SocialSignInProvider | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [birthdayChallenge, setBirthdayChallenge] = useState<SocialSignInChallenge | null>(null);
  const [isSubmittingBirthday, setIsSubmittingBirthday] = useState(false);
  const attemptGeneration = useRef(0);
  const isMounted = useRef(true);
  const saveSignedInSession = useAuthStore((s) => s.saveSignedInSession);

  useEffect(() => {
    isMounted.current = true;
    checkIfAppleSignInIsAvailableOnThisDevice().then((isAvailable) => {
      if (isMounted.current) setIsAppleSignInAvailable(isAvailable);
    });
    return () => {
      isMounted.current = false;
      attemptGeneration.current += 1;
    };
  }, []);

  const signInWithProvider = async (provider: SocialSignInProvider) => {
    if (providerSigningIn || isSubmittingBirthday) return;
    const generation = ++attemptGeneration.current;
    setFailureMessage(null);
    setBirthdayChallenge(null);
    setProviderSigningIn(provider);
    try {
      const attempt = await authService.beginSocialSignIn(provider);
      if (!isMounted.current || generation !== attemptGeneration.current) return;
      if (attempt.status === "birthday_required") {
        setBirthdayChallenge(attempt.challenge);
        return;
      }
      await saveSignedInSession(attempt.session);
    } catch (error) {
      if (isMounted.current && generation === attemptGeneration.current && !(error instanceof SocialSignInCancelledError)) {
        setFailureMessage(error instanceof Error ? error.message : "Sign-in failed");
      }
    } finally {
      if (isMounted.current && generation === attemptGeneration.current) setProviderSigningIn(null);
    }
  };

  const completeWithBirthday = async (birthday: string) => {
    if (!birthdayChallenge || providerSigningIn || isSubmittingBirthday) return;
    const generation = ++attemptGeneration.current;
    setFailureMessage(null);
    setIsSubmittingBirthday(true);
    try {
      const session = await authService.completeSocialSignInWithBirthday(birthdayChallenge, birthday);
      if (!isMounted.current || generation !== attemptGeneration.current) return;
      setBirthdayChallenge(null);
      await saveSignedInSession(session);
    } catch (error) {
      if (isMounted.current && generation === attemptGeneration.current) {
        setFailureMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
      }
    } finally {
      if (isMounted.current && generation === attemptGeneration.current) setIsSubmittingBirthday(false);
    }
  };

  const cancelBirthdayChallenge = () => {
    if (isSubmittingBirthday) return;
    attemptGeneration.current += 1;
    setBirthdayChallenge(null);
    setFailureMessage(null);
    setProviderSigningIn(null);
  };

  return {
    isAppleSignInAvailable,
    providerSigningIn,
    failureMessage,
    birthdayChallenge,
    isSubmittingBirthday,
    signInWithProvider,
    completeWithBirthday,
    cancelBirthdayChallenge,
  };
}
