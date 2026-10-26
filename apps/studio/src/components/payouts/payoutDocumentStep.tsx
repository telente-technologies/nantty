"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StudioRequestError } from "@/services/clientApi.service";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import styles from "./payoutOnboarding.module.css";
import { PayoutStepFrame } from "./payoutStepFrame";

export const PAYOUT_VERIFICATION_CHANNEL = "zudomart-payout-verification";
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

interface PayoutDocumentStepProps {
  readonly state: PayoutOnboardingState;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly onChanged: () => Promise<unknown> | void;
}

export function PayoutDocumentStep({ state, stepNumber, stepCount, onChanged }: PayoutDocumentStepProps) {
  const [isChecking, setIsChecking] = useState(false);
  const isCheckingRef = useRef(false);
  const open = useMutation({
    mutationFn: payoutOnboardingService.createDocumentLink,
    onSuccess: (link) => {
      window.open(link.url, "zudomart-payout-verification", "popup,width=520,height=760");
      void onChanged();
    },
  });

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

  if (state.accountStatus === "failed") return <p className={`${styles.notice} ${styles.noticeError}`}>We couldn't finish setting up your payout account. We'll keep trying automatically. Your details are saved.</p>;
  if (state.accountStatus !== "documentsRequired") {
    return (
      <div className={styles.center} role="status">
        <strong>We're setting up your payout account</strong>
        <p className={styles.muted}>You can verify your ID once it's ready. We'll notify you. Everything else keeps working.</p>
      </div>
    );
  }
  if (isChecking) return <div className={styles.center} role="status"><strong>Checking your documents…</strong></div>;

  const isUnavailable = open.error instanceof StudioRequestError && open.error.status === 503;
  const isUnfinished = state.documentStatus === "link_issued" && !open.isError;
  return (
    <PayoutStepFrame stepNumber={stepNumber} stepCount={stepCount} title={isUnfinished ? "Verify your ID: not finished" : "Verify your ID"} why="A photo of your government ID is the last check. It is collected on a secure verification page, so the image never passes through Nantty.">
      <p className={styles.muted}>A secure page opens in a new window. Upload your ID there and it closes and brings you back here. Your progress is already saved.</p>
      <p className={styles.muted}>Accepted: national ID card, international passport, driver's licence or voter's card. Photos must be clear and show all four corners.</p>
      {isUnavailable ? <p className={styles.notice}>We couldn't open the verification page right now. Try again in a moment.</p> : null}
      {open.isError && !isUnavailable ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{open.error.message}</p> : null}
      <div className={styles.actions}>
        <Button busy={open.isPending} onClick={() => open.mutate()}>{isUnavailable ? "Try again" : isUnfinished ? "Continue" : "Open secure verification"}</Button>
      </div>
    </PayoutStepFrame>
  );
}
