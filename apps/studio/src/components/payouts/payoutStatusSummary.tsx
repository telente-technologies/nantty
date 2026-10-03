"use client";

import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import type { PayoutOnboardingState, PayoutOnboardingStep, PayoutSyncStatus } from "@/types/payoutOnboarding.type";
import { Badge } from "@/components/ui/feedback";

import styles from "./payoutOnboarding.module.css";

const copy = {
  pending_review: { title: "Pending review", withdrawals: "Withdrawals stay locked until review finishes. Your earnings keep building and nothing is lost." },
  action_needed: { title: "Action needed", withdrawals: "Withdrawals stay locked until you fix these. Your earnings keep building in the meantime." },
  verified: { title: "You're verified", withdrawals: "You can withdraw available earnings to your bank account in the Zudomart app. Your first withdrawal is held for one quick safety review." },
} as const;

const stepLabels: Record<PayoutOnboardingStep, string> = { identity: "Personal details", business: "Business details", bank: "Bank account", document: "ID document" };
const syncLabels: Record<PayoutSyncStatus, string> = { saved: "Saved", sending: "Sending", done: "Done", needs_attention: "Needs attention" };
const syncTones: Record<PayoutSyncStatus, "neutral" | "success" | "warning" | "error"> = { saved: "neutral", sending: "warning", done: "success", needs_attention: "error" };

export function PayoutSyncList({ state }: { readonly state: PayoutOnboardingState }) {
  const steps = state.completedSteps.filter((step) => state.syncByStep[step]);
  return (
    <div>
      {steps.map((step) => (
        <div key={step} className={styles.syncRow}>
          <span>{stepLabels[step]}</span>
          <Badge tone={syncTones[state.syncByStep[step]!]}>{syncLabels[state.syncByStep[step]!]}</Badge>
        </div>
      ))}
    </div>
  );
}

interface PayoutStatusSummaryProps {
  readonly state: PayoutOnboardingState;
  readonly onFix: () => void;
  readonly onChanged: () => void;
}

export function PayoutStatusSummary({ state, onFix, onChanged }: PayoutStatusSummaryProps) {
  const key = state.status === "verified" ? "verified" : state.status === "action_needed" ? "action_needed" : "pending_review";
  const retry = useMutation({ mutationFn: payoutOnboardingService.retryAccountCreation, onSuccess: onChanged });
  const sharedNote = key === "verified" && state.verifiedVia && state.verifiedVia !== "creator" ? `Your ${state.verifiedVia} payout setup covers this too. One payout account for everything you earn, so there is nothing more to do.` : null;
  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <h2 className={styles.title}>{copy[key].title}</h2>
        <p className={styles.muted}>
          {key === "pending_review" ? `We're reviewing your documents.${state.reviewEstimate ? ` This usually takes ${state.reviewEstimate}.` : ""} You can carry on, we'll notify you when it's done.` : key === "action_needed" ? "We couldn't finish verifying you. Fix the items below. Nothing you already entered is lost." : "Your payout account is verified."}
        </p>
        {sharedNote ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{sharedNote}</p> : null}
        {key === "action_needed" ? state.reasons.map((reason) => (
          <div key={reason.code}><strong>{stepLabels[reason.step]}</strong><p className={styles.muted}>{reason.message}</p></div>
        )) : null}
        {state.bankSummary ? <p className={styles.muted}>Payout account: <strong>{state.bankSummary}</strong></p> : null}
        {retry.isError ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{retry.error.message}</p> : null}
        <div className={styles.actions}>
          {key === "action_needed" ? <Button onClick={onFix}>Fix it</Button> : null}
          {state.accountStatus === "failed" ? <Button variant="secondary" busy={retry.isPending} onClick={() => retry.mutate()}>Try again</Button> : null}
        </div>
      </div>
      <div className={styles.card}>
        <strong>What this means for withdrawals</strong>
        <p className={styles.muted}>{copy[key].withdrawals}</p>
      </div>
    </div>
  );
}
