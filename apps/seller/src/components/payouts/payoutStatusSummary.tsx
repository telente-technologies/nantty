"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import styles from "./payoutOnboarding.module.css";

const copy = {
  pending_review: { title: "Pending review", withdrawals: "Withdrawals stay locked until review finishes. Your earnings keep building and nothing is lost." },
  action_needed: { title: "Action needed", withdrawals: "Withdrawals stay locked until you fix these. Your earnings keep building in the meantime." },
  verified: { title: "You're verified", withdrawals: "You can withdraw available earnings to your bank account. Your first withdrawal is held for one quick safety review." },
} as const;

const stepLabels = { identity: "Personal details", business: "Business details", bank: "Bank account", document: "ID document" } as const;

export function PayoutStatusSummary({ state, context, onFix, onChanged }: { readonly state: PayoutOnboardingState; readonly context: "seller" | "creator"; readonly onFix: () => void; readonly onChanged: () => void }) {
  const key = state.status === "verified" ? "verified" : state.status === "action_needed" ? "action_needed" : "pending_review";
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const sharedNote = key === "verified" && state.verifiedVia && state.verifiedVia !== context ? `Your ${state.verifiedVia} payout setup covers this too. One payout account for everything you earn, so there is nothing more to do.` : null;

  async function retry() {
    setIsRetrying(true);
    setRetryError(null);
    try {
      await sendSellerApiRequest("/payments/payout-onboarding/me/retry", { method: "POST" });
      onChanged();
    } catch (error) {
      setRetryError(readErrorMessageForDisplay(error));
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className={styles.stack}>
      <Panel title={copy[key].title}>
        <div className={styles.stack}>
          <p className={styles.muted}>
            {key === "pending_review" ? `We're reviewing your documents.${state.reviewEstimate ? ` This usually takes ${state.reviewEstimate}.` : ""} You can carry on, we'll notify you when it's done.` : key === "action_needed" ? "We couldn't finish verifying you. Fix the items below. Nothing you already entered is lost." : "Your payout account is verified."}
          </p>
          {sharedNote ? <Callout tone="success">{sharedNote}</Callout> : null}
          {key === "action_needed" ? state.reasons.map((reason) => (
            <div key={reason.code} className={styles.reason}><strong>{stepLabels[reason.step]}</strong><span className={styles.muted}>{reason.message}</span></div>
          )) : null}
          {state.bankSummary ? <p className={styles.muted}>Payout account: <strong>{state.bankSummary}</strong></p> : null}
          {retryError ? <Callout tone="error">{retryError}</Callout> : null}
          {key === "action_needed" ? <div className={styles.actions}><Button variant="primary" onClick={onFix}>Fix it</Button></div> : null}
          {state.accountStatus === "failed" ? <div className={styles.actions}><Button isBusy={isRetrying} onClick={() => void retry()}>Try again</Button></div> : null}
        </div>
      </Panel>
      <Panel title="What this means for withdrawals"><p className={styles.muted}>{copy[key].withdrawals}</p></Panel>
    </div>
  );
}
