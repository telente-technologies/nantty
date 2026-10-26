"use client";

import { useIsOnline } from "@nantty/web-kit";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";

type ConsentStatus = "not_started" | "pending" | "verified" | "failed" | "manual_review";
interface ConsentStart {
  readonly status: ConsentStatus;
  readonly consentUrl?: string;
  readonly reference?: string;
}

const path = "/payments/payout-onboarding/me/bank-validation";

function isSafeConsentUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function BvnConsentPanel() {
  const isOnline = useIsOnline();
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startingRef = useRef(false);

  const refresh = useCallback(() => {
    void sendSellerApiRequest<{ status: ConsentStatus }>(path).then((result) => setStatus(result.status), (error: unknown) => setErrorMessage(readErrorMessageForDisplay(error)));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    if (status !== "pending" || !isOnline) return;
    const timer = setInterval(refresh, 5_000);
    return () => clearInterval(timer);
  }, [status, isOnline, refresh]);

  async function start() {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const started = await sendSellerApiRequest<ConsentStart>(path, { method: "POST", query: { returnTo: `${window.location.origin}/settings/payouts?bvnConsent=returned` } });
      setStatus(started.status);
      if (started.consentUrl) {
        if (!isSafeConsentUrl(started.consentUrl)) throw new Error("Unexpected consent page. Contact support.");
        window.location.assign(started.consentUrl);
        return;
      }
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    }
    startingRef.current = false;
    setIsStarting(false);
  }

  if (status === null && !errorMessage) return null;
  if (status === "verified") return <Callout tone="success" title="BVN confirmed">Your bank confirmed your BVN. Your wallet account is set up in your name.</Callout>;
  return (
    <Panel title="Confirm your BVN" description="Nigerian payouts need your consent to check your BVN with your bank. We never see your bank login, and we only keep what the check needs.">
      {status === "pending" ? <Callout tone="info" title="Waiting for your bank">{isOnline ? "We're checking your consent. This page updates on its own." : "You're offline. We'll check again when you're back online."}</Callout> : null}
      {status === "failed" ? <Callout tone="error" title="We couldn't confirm your BVN">Check that the name in your payout details matches your bank, then try again.</Callout> : null}
      {status === "manual_review" ? <Callout tone="caution" title="In review">We&apos;re reviewing your details. We&apos;ll tell you when it&apos;s done.</Callout> : null}
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      {status !== "manual_review" ? <Button variant="primary" isBusy={isStarting} onClick={() => void start()}>{status === "pending" ? "Open consent again" : "Give consent"}</Button> : null}
    </Panel>
  );
}
