"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import styles from "@/components/settings/settings.module.css";
import { legalLinks } from "@/config/legalLinks.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { identityVerificationService } from "@/services/identityVerification.service";
import { openSmileIdCapture } from "@/services/smileIdWebIntegration.service";
import type { IdentityJourney } from "@/types/identityVerification.type";
import { describeEligibilityReason, describeRefund } from "@/utils/identityVerificationCopy.util";

import { IdentityConsentForm } from "./identityConsentForm";

const journeyKey = ["verification", "journey"] as const;

const isWaitingForResult = (journey: IdentityJourney | undefined) => journey?.case?.status === "processing" || (journey?.case?.status === "awaiting_capture" && journey.case.consentGiven);

function StatusBlock({ title, text, tone = "muted" }: { readonly title: string; readonly text: string; readonly tone?: "muted" | "error" }) {
  return (
    <section className={styles.block} aria-live="polite">
      <h2 className={styles.blockHeading}>{title}</h2>
      <p className={tone === "error" ? styles.errorText : styles.muted}>{text}</p>
    </section>
  );
}

export function IdentityVerificationHub() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const step = searchParams.get("step");
  const returningFromPayment = step === "paid" || searchParams.has("reference");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const journeyQuery = useQuery({ queryKey: journeyKey, queryFn: identityVerificationService.fetchVerificationJourney, refetchInterval: (query) => (isWaitingForResult(query.state.data) || (returningFromPayment && !query.state.data?.case) ? 4000 : false) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: journeyKey });
  const request = useMutation({ mutationFn: identityVerificationService.requestVerification, onSuccess: refresh });
  const checkout = useMutation({
    mutationFn: (journey: IdentityJourney) => identityVerificationService.startCheckmarkCheckout({ profileId: journey.profileId, planCode: journey.planCode, interval: billingInterval, returnTo: `${window.location.origin}/settings/verification` }),
    onSuccess: (started) => window.location.assign(started.authorizationUrl),
  });
  const capture = useMutation({
    mutationFn: async (input: { journey: IdentityJourney; documentCountry: string; documentType: string }) => {
      if (!input.journey.case) throw new Error("Pay for your checkmark first.");
      const session = await identityVerificationService.startIdentityCapture(input.journey.case.id, { consentVersion: input.journey.consentVersion, consentAccepted: true, documentCountry: input.documentCountry, documentType: input.documentType });
      return openSmileIdCapture(session, legalLinks.privacyPolicy);
    },
    onSettled: refresh,
  });

  if (journeyQuery.isLoading) return <Spinner label="Checking your eligibility" />;
  if (journeyQuery.isError || !journeyQuery.data) return <ErrorState description="We couldn't load your verification." action={<RetryButton onRetry={() => journeyQuery.refetch()} />} />;
  const journey = journeyQuery.data;
  const badge = journey.color === "gold" ? "Gold" : "Blue";

  if (journey.blackVetting) return <StatusBlock title="Black checkmark: government" text="Government bodies are verified through official vetting with two independent approvals, not this check. Apply from the Zudomart Dashboard." />;
  if (journey.checkmark?.badgeVisible) return <StatusBlock title="You're verified" text={`Your ${badge} checkmark is on your profile.`} />;
  const verification = journey.case;
  if (verification?.status === "under_review") return <StatusBlock title="Under review" text="Some checks need a closer look. A person will review them within 3 days and we'll notify you. If we can't approve it, you get a full refund." />;
  if (isWaitingForResult(journey)) return <StatusBlock title="Checking your selfie and ID" text="This usually takes a minute or two. You can leave this page; we'll notify you." />;
  if (verification && (verification.status === "awaiting_consent" || verification.status === "awaiting_capture")) {
    return (
      <>
        <StatusBlock title="Payment received. One last step" text={`Your ${badge} checkmark is paid for. Confirm it's you with a selfie and a photo of your government ID.`} />
        <IdentityConsentForm busy={capture.isPending} errorMessage={capture.isError ? readErrorMessageForDisplay(capture.error) : null} onStart={(choice) => capture.mutate({ journey, ...choice })} />
      </>
    );
  }

  const eligibility = journey.eligibility;
  const missing = (eligibility?.reasons ?? []).map(describeEligibilityReason).filter((line): line is string => line !== null);
  return (
    <>
      {verification?.status === "rejected" ? <StatusBlock tone="error" title="We couldn't verify your account" text={`${verification.decisionReason ? `${verification.decisionReason} ` : ""}${describeRefund(verification.refundMethod, verification.refundStatus, verification.refundScope)} You can try again after 30 days.`} /> : null}
      <section className={styles.block} aria-labelledby="checkmark-heading">
        <h2 id="checkmark-heading" className={styles.blockHeading}>The {badge} checkmark</h2>
        <p className={styles.muted}>{journey.color === "gold" ? "For businesses and brands." : "For people, including creators."} You pay first, then confirm your identity with a selfie and a government photo ID. If we can&apos;t approve you, you get a full refund.</p>
        {eligibility?.canBuyNow ? (
          <>
            {step === "pay" ? <p className={styles.muted}>Good news: you can now apply.</p> : null}
            <div className={styles.radioGroup} role="radiogroup" aria-label="Billing interval">
              <label className={styles.radioRow}><input type="radio" checked={billingInterval === "month"} onChange={() => setBillingInterval("month")} /><span>Monthly</span></label>
              <label className={styles.radioRow}><input type="radio" checked={billingInterval === "year"} onChange={() => setBillingInterval("year")} /><span>Yearly (save 20%)</span></label>
            </div>
            {checkout.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(checkout.error)}</p> : null}
            <div className={styles.buttonRow}><Button busy={checkout.isPending} onClick={() => checkout.mutate(journey)}>Buy now</Button></div>
          </>
        ) : eligibility?.state === "requested" ? (
          <p className={styles.muted}>Request received. We&apos;ll check your account again regularly and notify you as soon as you can apply.</p>
        ) : eligibility?.tier === "blocked" ? (
          <p className={styles.muted}>Verification isn&apos;t available for this account right now. Check your account status for details.</p>
        ) : (
          <div className={styles.buttonRow}><Button variant="secondary" busy={request.isPending} onClick={() => request.mutate()}>Request verification</Button></div>
        )}
        {missing.length > 0 && !eligibility?.canBuyNow ? <ul className={styles.bulletList}>{missing.map((line) => <li key={line}>{line}</li>)}</ul> : null}
        {request.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(request.error)}</p> : null}
      </section>
    </>
  );
}
