import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import type { PayoutOnboardingState, PayoutOnboardingStep, PayoutSyncStatus } from "@/types/payoutOnboarding.type";

import styles from "./payoutOnboarding.module.css";

const stepLabels: Record<PayoutOnboardingStep, string> = { identity: "Personal details", business: "Business details", bank: "Bank account", document: "ID document" };
const syncLabels: Record<PayoutSyncStatus, string> = { saved: "Saved", sending: "Sending", done: "Done", needs_attention: "Needs attention" };
const syncTones: Record<PayoutSyncStatus, StatusTone> = { saved: "neutral", sending: "caution", done: "success", needs_attention: "error" };

export function PayoutSyncList({ state }: { readonly state: PayoutOnboardingState }) {
  const steps = state.completedSteps.filter((step) => state.syncByStep[step]);
  if (steps.length === 0) return null;
  return (
    <div>
      {steps.map((step) => (
        <div key={step} className={styles.syncRow}>
          <span>{stepLabels[step]}</span>
          <StatusBadge tone={syncTones[state.syncByStep[step]!]}>{syncLabels[state.syncByStep[step]!]}</StatusBadge>
        </div>
      ))}
    </div>
  );
}
