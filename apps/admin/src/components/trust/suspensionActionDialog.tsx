"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { SelectField } from "@/components/ui/formFields";
import { suspensionReasonOptions } from "@/constants/trustOptions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideSuspensionCase, type SuspensionCaseDecision } from "@/services/safetyApi.service";
import type { SuspensionCaseDetail, SuspensionReasonCode } from "@/types/suspensions.type";

const presentations: Record<SuspensionCaseDecision, { title: string; confirmLabel: string; isDestructive: boolean; consequences: (username: string) => string[] }> = {
  approve: { title: "Approve suspension", confirmLabel: "Suspend account", isDestructive: true, consequences: (username) => [`@${username} is signed out and cannot post, sell, go live or message.`, "Their profile and chats show a suspended state. Open orders keep running through escrow.", "The 120-day deletion clock starts. Reinstating before then stops it."] },
  dismiss: { title: "Dismiss this case", confirmLabel: "Dismiss case", isDestructive: false, consequences: (username) => [`@${username} stays active and nothing is sent to them.`, "The suggestion is kept so the risk model can learn from your decision."] },
  escalate: { title: "Escalate for senior review", confirmLabel: "Escalate case", isDestructive: false, consequences: () => ["The case stays open and is flagged for a senior admin.", "Nothing changes for the account until someone decides."] },
};

export const suspensionDecisionLabels: Record<SuspensionCaseDecision, string> = { approve: "Approve suspension", dismiss: "Dismiss", escalate: "Escalate" };

export function SuspensionActionDialog({ suspensionCase, decision, onClose, onCompleted }: { readonly suspensionCase: SuspensionCaseDetail; readonly decision: SuspensionCaseDecision | null; readonly onClose: () => void; readonly onCompleted: (updated: SuspensionCaseDetail, decision: SuspensionCaseDecision) => void }) {
  const [reasonCode, setReasonCode] = useState<SuspensionReasonCode>("FRAUD");
  const mutation = useAdminMutation((input: { decision: SuspensionCaseDecision; reason: string }) => decideSuspensionCase(suspensionCase.id, input.decision, { reason: input.reason, reasonCode: input.decision === "approve" ? reasonCode : undefined }));
  if (!decision) return null;
  const presentation = presentations[decision];

  async function confirm(reason: string) {
    if (!decision) return;
    const updated = await mutation.run({ decision, reason });
    if (updated) onCompleted(updated, decision);
  }

  return (
    <ConfirmActionDialog intent="suspend"
      isOpen
      title={presentation.title}
      consequences={presentation.consequences(suspensionCase.user.username)}
      confirmLabel={presentation.confirmLabel}
      tone={presentation.isDestructive ? "danger" : "default"}
      reasonLabel={decision === "approve" ? "Note (saved to the audit log)" : undefined}
      requiresStepUp
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirm}
      onClose={() => { mutation.clearError(); onClose(); }}
    >
      {decision === "approve" ? <SelectField label="Reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value as SuspensionReasonCode)} options={suspensionReasonOptions} /> : null}
    </ConfirmActionDialog>
  );
}
