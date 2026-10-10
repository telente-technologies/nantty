"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createIdempotencyKey } from "@/services/adminApiClient.service";
import { reviewWithdrawal } from "@/services/moneyApi.service";
import type { StaffWithdrawalDetail, WithdrawalDecision } from "@/types/withdrawals.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

const decisionCopy: Record<WithdrawalDecision, { title: string; confirm: string; toast: string; consequence: string }> = {
  approve: { title: "Approve withdrawal", confirm: "Approve and queue", toast: "Withdrawal approved", consequence: "The payout is queued and sent to the bank on the next payout run. It cannot be pulled back once sent." },
  hold: { title: "Put withdrawal on hold", confirm: "Put on hold", toast: "Withdrawal put on hold", consequence: "The money stays reserved and is not sent until someone approves or rejects it." },
  reject: { title: "Reject withdrawal", confirm: "Reject withdrawal", toast: "Withdrawal rejected", consequence: "The amount goes back to the user's available balance and they are told why." },
};

export function WithdrawalDecisionDialog({ withdrawal, decision, onClose, onDecided }: { readonly withdrawal: StaffWithdrawalDetail; readonly decision: WithdrawalDecision; readonly onClose: () => void; readonly onDecided: (updated: StaffWithdrawalDetail) => void }) {
  const { showToast } = useToast();
  const [idempotencyKey] = useState(createIdempotencyKey);
  const mutation = useAdminMutation((reason: string) => reviewWithdrawal(withdrawal.id, { decision, reason, idempotencyKey }));
  const copy = decisionCopy[decision];
  const destination = withdrawal.destination;

  async function confirmDecision(reason: string) {
    const updated = await mutation.run(reason);
    if (updated) {
      showToast(`${copy.toast}: ${formatMoneyForDisplay(updated.amount)}`);
      onDecided(updated);
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={copy.title}
      description={`${formatMoneyForDisplay(withdrawal.amount)}${destination ? ` to ${destination.bankName} ••••${destination.accountLast4} (${destination.accountName})` : ""}.`}
      consequences={[copy.consequence, `The ${formatMoneyForDisplay(withdrawal.fee)} fee is passed through; the user receives ${formatMoneyForDisplay(withdrawal.netAmount)}.`]}
      confirmLabel={copy.confirm}
      tone={decision === "hold" ? "default" : "danger"}
      requiresReason={decision !== "approve"}
      reasonMaximumLength={300}
      requiresStepUp
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmDecision}
      onClose={onClose}
    />
  );
}
