"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import styles from "@/components/settings/settings.module.css";
import { legalLinks } from "@/config/legalLinks.config";
import { useCountryRequiredRetry } from "@/components/commerce/countryRequiredDialog";
import { isCountryRequiredError } from "@/components/commerce/countryRequiredPicker";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { identityVerificationService } from "@/services/identityVerification.service";
import { runSmileIdCapture } from "@/services/smileIdWebIntegration.service";
import type { IdentityJourney } from "@/types/identityVerification.type";
import type { IdentityCaptureChoice } from "@/types/identityVerification.type";
import { describeEligibilityReason, describeRefund } from "@/utils/identityVerificationCopy.util";

import { IdentityConsentForm } from "./identityConsentForm";
import { GovernmentBlackHub } from "./governmentBlackHub";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";

const journeyKey = ["verification", "journey"] as const;

const isWaitingForResult = (journey: IdentityJourney | undefined) => journey?.case?.status === "processing";
const shouldRefreshVerification = (journey: IdentityJourney | undefined) => isWaitingForResult(journey) || (journey?.case?.status === "awaiting_capture" && journey.case.consentGiven && !journey.case.canRetry);

function StatusBlock({ title, text, tone = "muted", action }: { readonly title: string; readonly text: string; readonly tone?: "muted" | "error"; readonly action?: { readonly label: string; readonly href: string } }) {
  return (
    <section className={styles.block} aria-live="polite">
      <h2 className={styles.blockHeading}>{title}</h2>
      <p className={tone === "error" ? styles.errorText : styles.muted}>{text}</p>
      {action ? <Link href={action.href}>{action.label}</Link> : null}
    </section>
  );
}

const APP_PAYMENT_RETURN_URL = "nantty://payments/return";
const readAppReturnUrl = (value: string | null) => (value === APP_PAYMENT_RETURN_URL ? value : null);

export function IdentityVerificationHub() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const step = searchParams.get("step");
  const returningFromPayment = step === "paid" || searchParams.has("reference");
  const appReturnUrl = readAppReturnUrl(searchParams.get("return"));
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const { retry: countryRetry, dialog: countryDialog } = useCountryRequiredRetry();
  const journeyQuery = useQuery({ queryKey: journeyKey, queryFn: identityVerificationService.fetchVerificationJourney, refetchInterval: (query) => (shouldRefreshVerification(query.state.data) || (returningFromPayment && !query.state.data?.case) ? 15000 : false) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: journeyKey });
  const request = useMutation({ mutationFn: identityVerificationService.requestVerification, onSuccess: refresh });
  const checkout = useMutation({
    mutationFn: (journey: IdentityJourney) => identityVerificationService.startCheckmarkCheckout({ profileId: journey.profileId, planCode: journey.planCode, interval: billingInterval, returnTo: `${window.location.origin}/settings/verification${appReturnUrl ? `?return=${encodeURIComponent(appReturnUrl)}` : ""}` }),
    onSuccess: (started) => window.location.assign(started.authorizationUrl),
    onError: (error, journey) => {
      countryRetry.handle(error instanceof WebappRequestError ? error.code : null, () => checkout.mutate(journey));
    },
  });
  const paidCase = journeyQuery.data?.case;
  useEffect(() => {
    if (appReturnUrl && returningFromPayment && paidCase) window.location.replace(`${appReturnUrl}?purpose=checkmark`);
  }, [appReturnUrl, returningFromPayment, paidCase]);
  const capture = useMutation({
    mutationFn: async (input: { journey: IdentityJourney } & IdentityCaptureChoice) => {
      if (!input.journey.case) throw new Error("Pay for your checkmark first.");
      const session = await identityVerificationService.startIdentityCapture(input.journey.case.id, { consentVersion: input.journey.consentVersion, consentAccepted: true, verificationMethod: input.verificationMethod, verificationProduct: input.verificationProduct, documentCountry: input.documentCountry, documentType: input.documentType });
      if (session.mode === "hosted_link") {
        if (!session.url) throw new Error("The secure identity-check page could not be opened. Refresh your status and try again.");
        window.location.assign(session.url);
        return;
      }
      if (session.mode !== "web_integration" || !session.token) throw new Error("The identity-check session is incomplete. Refresh your status and try again.");
      return runSmileIdCapture(session, legalLinks.privacyPolicy, (caseId, captureAttemptId) => identityVerificationService.cancelIdentityCapture(caseId, captureAttemptId));
    },
    onSettled: refresh,
  });

  if (journeyQuery.isLoading) return <DetailSkeleton label="Checking your eligibility" blocks={2} />;
  if (journeyQuery.isError || !journeyQuery.data) return <ErrorState description="We couldn't load your verification." error={journeyQuery.error} onRetry={() => void journeyQuery.refetch()} />;
  const journey = journeyQuery.data;
  const badge = journey.color === "gold" ? "Gold" : "Blue";

  if (journey.blackVetting) return <GovernmentBlackHub profileId={journey.profileId} />;
  if (journey.checkmark?.badgeVisible) return <StatusBlock title="You're verified" text={`Your ${badge} checkmark is on your profile.`} />;
  const verification = journey.case;
  if (verification?.status === "under_review") return <StatusBlock title="Under review" text="Some checks need a closer look. A person will review them within 3 days and we'll notify you. If we can't approve it, you get a full refund." />;
  if (isWaitingForResult(journey)) return <StatusBlock title="Checking your identity" text="This usually takes a minute or two. You can leave this page; we'll notify you." />;
  if (verification?.status === "awaiting_capture" && verification.consentGiven && !verification.canRetry) {
    return <StatusBlock title="No result yet" text={`${capture.isError ? `${readErrorMessageForDisplay(capture.error)} ` : ""}This capture attempt remains open because a browser response cannot confirm whether Smile ID received a submission. Nantty will show a result only after Smile ID's signed callback. Do not start another check while this attempt is open; if no result arrives, retry after the session expires in about an hour or contact support. This page refreshes automatically. Please do not send your ID number or documents in a support message.`} action={{ label: "Contact support", href: "/help/tickets/new" }} />;
  }
  if (verification && (verification.status === "awaiting_consent" || verification.status === "awaiting_capture")) {
    return (
      <>
        {verification.retryableProviderError ? <StatusBlock title="That check couldn't be completed" text="Smile ID reported a temporary service or image issue. Start a new check and follow the capture instructions. If it keeps happening, contact support. This technical error did not approve or reject your identity." /> : null}
        <StatusBlock title="Payment received. One last step" text={`Your ${badge} checkmark is paid for. Confirm your identity with a supported photo ID or ID-number check.`} />
        <IdentityConsentForm busy={capture.isPending} errorMessage={capture.isError ? readErrorMessageForDisplay(capture.error) : null} privacyPolicyUrl={journey.privacyPolicyUrl} onStart={(choice) => capture.mutate({ journey, ...choice })} />
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
        <p className={styles.muted}>{journey.color === "gold" ? "For businesses and brands." : "For people, including creators."} You pay first, then confirm your identity using a supported photo ID or ID-number check. If we can&apos;t approve you, you get a full refund.</p>
        {eligibility?.canBuyNow ? (
          <>
            {step === "pay" ? <p className={styles.muted}>Good news: you can now apply.</p> : null}
            <div className={styles.radioGroup} role="radiogroup" aria-label="Billing interval">
              <label className={styles.radioRow}><input type="radio" checked={billingInterval === "month"} onChange={() => setBillingInterval("month")} /><span>Monthly</span></label>
              <label className={styles.radioRow}><input type="radio" checked={billingInterval === "year"} onChange={() => setBillingInterval("year")} /><span>Yearly (save 20%)</span></label>
            </div>
            {checkout.isError && !isCountryRequiredError(checkout.error) ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(checkout.error)}</p> : null}
            {countryDialog}
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
