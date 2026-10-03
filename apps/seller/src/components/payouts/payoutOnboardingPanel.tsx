"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { sendSellerApiRequest } from "@/services/clientApi.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import { PayoutBankForm } from "./payoutBankForm";
import { PayoutBusinessForm } from "./payoutBusinessForm";
import { PayoutDocumentStep, PAYOUT_VERIFICATION_CHANNEL } from "./payoutDocumentStep";
import { PayoutIdentityForm } from "./payoutIdentityForm";
import { PayoutStatusSummary } from "./payoutStatusSummary";
import { PayoutSyncList } from "./payoutSyncList";

const stepOrderNumbers = (state: PayoutOnboardingState) => {
  const stepCount = state.requiresBusinessStep ? 4 : 3;
  return { stepCount, stepNumber: { identity: 1, business: 2, bank: state.requiresBusinessStep ? 3 : 2, document: stepCount }[state.currentStep] };
};

export function PayoutOnboardingPanel({ context }: { readonly context: "seller" | "creator" }) {
  const query = useSellerQuery<PayoutOnboardingState>("/seller/payout-onboarding");
  const [isEditing, setIsEditing] = useState(false);
  const verificationParam = useSearchParams().get("verification");
  const handledParamRef = useRef<string | null>(null);
  const state = query.data;
  const { reload } = query;

  useEffect(() => {
    if (!state || (state.status !== "pending_review" && state.accountStatus !== "pending_creation")) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [state, reload]);

  useEffect(() => {
    if (!verificationParam || handledParamRef.current === verificationParam) return;
    handledParamRef.current = verificationParam;
    void (async () => {
      if (verificationParam === "mock") await sendSellerApiRequest("/seller/payout-onboarding/document-link/complete", { method: "POST" }).catch(() => undefined);
      const channel = new BroadcastChannel(PAYOUT_VERIFICATION_CHANNEL);
      channel.postMessage("returned");
      channel.close();
      if (window.opener) window.close();
      else reload();
    })();
  }, [verificationParam, reload]);

  const refresh = useCallback(async () => {
    reload();
    await Promise.resolve();
  }, [reload]);

  if (!state) return query.errorMessage ? <Callout tone="error">{query.errorMessage}</Callout> : <LoadingBlock />;
  if (verificationParam === "returned" || verificationParam === "mock") {
    return <Callout tone="success" title="Thanks, we've got your documents">You can close this window. The Zudomart tab you came from will pick up where you left off.</Callout>;
  }
  const showStatus = state.status === "pending_review" || state.status === "verified" || (state.status === "action_needed" && !isEditing);
  const { stepCount, stepNumber } = stepOrderNumbers(state);

  if (showStatus) return <PayoutStatusSummary state={state} context={context} onFix={() => setIsEditing(true)} onChanged={reload} />;
  return (
    <Panel title="Get paid" description="Set up once. The same details cover everything you earn on Zudomart.">
      <PayoutSyncList state={state} />
      {state.accountStatus === "failed" ? (
        <Callout tone="caution" title="We couldn't reach our payment partner" action={<Button size="small" onClick={() => void sendSellerApiRequest("/seller/payout-onboarding/retry", { method: "POST" }).then(reload)}>Try again</Button>}>We'll keep trying automatically. Your details are saved.</Callout>
      ) : state.accountStatus === "pending_creation" ? <Callout tone="info" title="Setting up your payout account…">This runs in the background. You can leave and come back.</Callout> : null}
      {state.currentStep === "identity" ? <PayoutIdentityForm state={state} stepCount={stepCount} onSaved={reload} /> : null}
      {state.currentStep === "business" ? <PayoutBusinessForm stepCount={stepCount} onSaved={reload} /> : null}
      {state.currentStep === "bank" ? <PayoutBankForm state={state} stepNumber={stepNumber} stepCount={stepCount} onSaved={reload} /> : null}
      {state.currentStep === "document" ? <PayoutDocumentStep state={state} stepNumber={stepNumber} stepCount={stepCount} onChanged={refresh} /> : null}
    </Panel>
  );
}
