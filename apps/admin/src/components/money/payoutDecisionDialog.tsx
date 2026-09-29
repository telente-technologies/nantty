"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { NoticeBanner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { decidePayout } from "@/services/moneyApi.service";
import type { PayoutDetail } from "@/types/payouts.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

export type PayoutDecision = "approve" | "hold" | "reject";

const decisionCopy: Record<PayoutDecision, { title: string; confirm: string; toast: string; consequence: string }> = {
  approve: { title: "Approve withdrawal", confirm: "Approve and send", toast: "Withdrawal approved", consequence: "Money is sent to the destination account through the provider. This cannot be pulled back." },
  hold: { title: "Put withdrawal on hold", confirm: "Put on hold", toast: "Withdrawal put on hold", consequence: "The money stays in the wallet until someone approves or rejects it." },
  reject: { title: "Reject withdrawal", confirm: "Reject withdrawal", toast: "Withdrawal rejected", consequence: "The amount returns to the user's wallet and they are told why." },
};

export function PayoutDecisionDialog({ payout, decision, onClose, onDecided }: { readonly payout: PayoutDetail; readonly decision: PayoutDecision; readonly onClose: () => void; readonly onDecided: (updated: PayoutDetail) => void }) {
  const { showToast } = useToast();
  const [idempotencyKey] = useState(createIdempotencyKey);
  const mutation = useAdminMutation((reason: string) => decidePayout(payout.id, decision, reason, decision === "approve" ? idempotencyKey : undefined));
  const copy = decisionCopy[decision];

  async function confirmDecision(reason: string) {
    const updated = await mutation.run(reason);
    if (updated) {
      showToast(`${copy.toast}: ${formatMoneyForDisplay(updated.amount)} for @${updated.user.username}`);
      onDecided(updated);
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={copy.title}
      description={`${formatMoneyForDisplay(payout.amount)} to ${payout.destination.institutionName} ${payout.destination.accountMasked} (${payout.destination.accountName}).`}
      consequences={[copy.consequence, `Provider fee ${formatMoneyForDisplay(payout.providerFee)} is passed through; the user receives ${formatMoneyForDisplay(payout.netAmount)}.`]}
      confirmLabel={copy.confirm}
      tone={decision === "hold" ? "default" : "danger"}
      requiresStepUp={decision === "approve"}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmDecision}
      onClose={onClose}
    >
      {decision === "approve" && payout.fraud.riskLevel !== "LOW" ? (
        <NoticeBanner tone={payout.fraud.riskLevel === "HIGH" ? "danger" : "caution"} title={`Fraud score ${payout.fraud.score}/100`}>
          {payout.fraud.reasons.join(" · ")}
        </NoticeBanner>
      ) : null}
    </ConfirmActionDialog>
  );
}
