"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SellerApiRequestError, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PayoutDocumentLink, PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

export const PAYOUT_VERIFICATION_CHANNEL = "zudomart-payout-verification";
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function PayoutDocumentStep({ state, stepNumber, stepCount, onChanged }: { readonly state: PayoutOnboardingState; readonly stepNumber: number; readonly stepCount: number; readonly onChanged: () => Promise<void> | void }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    const channel = new BroadcastChannel(PAYOUT_VERIFICATION_CHANNEL);
    channel.onmessage = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      setIsChecking(true);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await wait(1500);
        await onChanged();
      }
      isCheckingRef.current = false;
      setIsChecking(false);
    };
    return () => channel.close();
  }, [onChanged]);

  async function openVerification() {
    setIsOpening(true);
    setErrorMessage(null);
    setIsUnavailable(false);
    try {
      const link = await sendSellerApiRequest<PayoutDocumentLink>("/payments/payout-onboarding/me/document-link", { method: "POST" });
      window.open(link.url, "zudomart-payout-verification", "popup,width=520,height=760");
      void onChanged();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.status === 503) setIsUnavailable(true);
      else setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsOpening(false);
    }
  }

  if (state.accountStatus === "failed") {
    return (
      <Callout tone="caution" title="We couldn't reach our payment partner">
        We'll keep trying automatically. Your details are saved.
      </Callout>
    );
  }
  if (state.accountStatus !== "documentsRequired") {
    return (
      <div className={styles.center} role="status">
        <strong>We're setting up your payout account</strong>
        <p className={styles.muted}>You can verify your ID once it's ready. We'll notify you. Everything else keeps working.</p>
      </div>
    );
  }
  if (isChecking) {
    return (
      <div className={styles.center} role="status">
        <strong>Checking your documents…</strong>
      </div>
    );
  }

  const isUnfinished = state.documentStatus === "link_issued" && !isUnavailable;
  return (
    <PayoutStepFrame stepNumber={stepNumber} stepCount={stepCount} title={isUnfinished ? "Verify your ID: not finished" : "Verify your ID"} why="A photo of your government ID is the last check. It is collected on a secure verification page, so the image never passes through Nantty.">
      <p className={styles.muted}>A secure page opens in a new window. Upload your ID there and it closes and brings you back here. Your progress is already saved.</p>
      <p className={styles.muted}>Accepted: national ID card, international passport, driver's licence or voter's card. Photos must be clear and show all four corners.</p>
      {isUnavailable ? <Callout tone="caution">We couldn't open the verification page right now. Try again in a moment.</Callout> : null}
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <div className={styles.actions}>
        <Button variant="primary" isBusy={isOpening} onClick={() => void openVerification()}>{isUnavailable ? "Try again" : isUnfinished ? "Continue" : "Open secure verification"}</Button>
      </div>
    </PayoutStepFrame>
  );
}
