"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { verificationRequiredEventName } from "@/services/adsApiClient.service";
import { walletApi } from "@/services/walletApi.service";
import { readNanttyMainSiteUrl } from "@/constants/contact.constant";
import { readSafeVerifyUrl } from "@/utils/nanttyWallet.util";

const defaultMessage = "Verify your payout details to use Nantty Ads. Your verification keeps advertisers and creators safe.";

interface AdsVerificationState {
  readonly needsVerification: boolean;
  readonly message: string;
  readonly verifyUrl: string;
  readonly reload: () => void;
}

const fallbackVerifyUrl = () => `${readNanttyMainSiteUrl()}/settings/payouts`;
const AdsVerificationContext = createContext<AdsVerificationState>({ needsVerification: false, message: defaultMessage, verifyUrl: fallbackVerifyUrl(), reload: () => undefined });

export function AdsVerificationProvider({ isSignedIn, children }: { readonly isSignedIn: boolean; readonly children: ReactNode }) {
  const [needsVerification, setNeedsVerification] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [verifyUrl, setVerifyUrl] = useState(fallbackVerifyUrl);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    let isCurrent = true;
    walletApi
      .fetchAdsVerification()
      .then((verification) => {
        if (!isCurrent) return;
        setNeedsVerification(verification.verified === false);
        if (verification.message) setMessage(verification.message);
        setVerifyUrl(readSafeVerifyUrl(verification.verifyUrl, fallbackVerifyUrl()));
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [isSignedIn, reloadCounter]);

  useEffect(() => {
    const showPrompt = (event: Event) => {
      const announced = (event as CustomEvent<{ message: string | null }>).detail?.message;
      if (announced) setMessage(announced);
      setNeedsVerification(true);
    };
    window.addEventListener(verificationRequiredEventName, showPrompt);
    return () => window.removeEventListener(verificationRequiredEventName, showPrompt);
  }, []);

  const reload = useCallback(() => setReloadCounter((counter) => counter + 1), []);
  const value = useMemo(() => ({ needsVerification, message, verifyUrl, reload }), [needsVerification, message, verifyUrl, reload]);
  return <AdsVerificationContext.Provider value={value}>{children}</AdsVerificationContext.Provider>;
}

export function useAdsVerification(): AdsVerificationState {
  return useContext(AdsVerificationContext);
}
