"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import { PayoutBankForm } from "./payoutBankForm";
import { PayoutDocumentStep, PAYOUT_VERIFICATION_CHANNEL } from "./payoutDocumentStep";
import { PayoutIdentityForm } from "./payoutIdentityForm";
import { PayoutSyncList, PayoutStatusSummary } from "./payoutStatusSummary";
import { payoutStateQueryKey } from "./payoutStateQuery.hook";
import { BvnConsentNotice, WalletAccountSummary } from "./walletAccountAndConsent";


import styles from "./payoutOnboarding.module.css";

export function PayoutOnboardingPanel() {
  const queryClient = useQueryClient();
  const verification = useSearchParams().get("verification");
  const handledRef = useRef<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const query = useQuery({
    queryKey: payoutStateQueryKey,
    queryFn: payoutOnboardingService.fetchState,
    refetchInterval: (current) => (current.state.data?.status === "pending_review" || current.state.data?.accountStatus === "pending_creation" ? 5000 : false),
  });
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: payoutStateQueryKey }), [queryClient]);

  useEffect(() => {
    if (!verification || handledRef.current === verification) return;
    handledRef.current = verification;
    void (async () => {
      if (verification === "mock") await payoutOnboardingService.completeMockDocumentUpload().catch(() => undefined);
      const channel = new BroadcastChannel(PAYOUT_VERIFICATION_CHANNEL);
      channel.postMessage("returned");
      channel.close();
      if (window.opener) window.close();
      else void refresh();
    })();
  }, [verification, refresh]);

  const state = query.data;
  if (verification === "mock" || verification === "returned") {
    return (
      <p className={`${styles.notice} ${styles.noticeSuccess}`}>
        Thanks, we've got your documents. You can close this window and go back to Studio.
      </p>
    );
  }
  if (!state) {
    return query.isError ? (
      <ErrorState title="Payout setup didn't load" error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <Skeleton height={180} />
    );
  }

  const showStatus = state.status === "pending_review" || state.status === "verified" || (state.status === "action_needed" && !isEditing);
  if (showStatus) {
    return (
      <div className={styles.stack}>
        {state.idType === "bvn" && state.bankSummary ? <BvnConsentNotice /> : null}
        {state.status === "verified" ? <WalletAccountSummary /> : null}
        <PayoutStatusSummary state={state} onFix={() => setIsEditing(true)} onChanged={() => void refresh()} />
      </div>
    );
  }

  const stepCount = 2 + (state.requiresBusinessStep ? 1 : 0) + (state.requiresDocumentStep ? 1 : 0);
  const stepNumber = { identity: 1, business: 2, bank: state.requiresBusinessStep ? 3 : 2, document: stepCount, done: stepCount }[state.currentStep];
  return (
    <div className={styles.stack}>
      <PayoutSyncList state={state} />
      {state.accountStatus === "pending_creation" ? <p className={styles.notice} role="status">Setting up your payout account… This runs in the background. You can leave and come back.</p> : null}
      {state.accountStatus === "failed" ? (
        <p className={`${styles.notice} ${styles.noticeError}`}>We couldn't finish setting up your payout account. We'll keep trying automatically.{" "}
          <Button size="sm" variant="secondary" onClick={() => void payoutOnboardingService.retryAccountCreation().then(refresh)}>Try again</Button>
        </p>
      ) : null}
      {state.currentStep === "identity" ? <PayoutIdentityForm state={state} stepCount={stepCount} onSaved={() => void refresh()} /> : null}
      {state.currentStep === "business" ? <p className={styles.notice}>Add your CAC business details in the Zudomart app or the seller dashboard under Payouts. Your creator payouts follow the same account.</p> : null}
      {state.currentStep === "bank" ? <PayoutBankForm state={state} stepNumber={stepNumber} stepCount={stepCount} onSaved={() => void refresh()} /> : null}
      {state.currentStep === "done" ? <p className={styles.notice} role="status">Your payout details are saved. We'll let you know if anything else is needed.</p> : null}
      {state.currentStep === "document" ? <PayoutDocumentStep state={state} stepNumber={stepNumber} stepCount={stepCount} onChanged={refresh} /> : null}
    </div>
  );
}
