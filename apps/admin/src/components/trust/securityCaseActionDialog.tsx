"use client";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideSecurityCase } from "@/services/securityCasesApi.service";
import type { SecurityCaseAction, SecurityCaseDetail } from "@/types/securityCases.type";

export const securityActionLabels: Record<SecurityCaseAction, string> = { clear: "Clear", keep_restricted: "Keep restricted", suspend: "Suspend", ban: "Ban", delete: "Delete account" };

const consequences: Record<SecurityCaseAction, (username: string) => string[]> = {
  clear: (username) => [`@${username}'s security flag and any bot mark are removed, so they stop seeing human checks.`, "If automation suspended the account, reinstate it from Suspensions → Suspended accounts."],
  keep_restricted: (username) => [`@${username} keeps getting human checks and loses posting, comments, messages and selling for 30 days.`, "They can still browse, buy and use their wallet."],
  suspend: (username) => [`@${username} is signed out and suspended. They can appeal from the suspension notice.`, "Open orders keep running through escrow."],
  ban: (username) => [`@${username} is banned and every session is revoked.`, "Only someone with the ban permission can lift it."],
  delete: (username) => [`@${username}'s account is deleted. Their profile and content are removed.`, "Orders, payments and ledger entries are kept but anonymised, as the law requires.", "This cannot be undone. Pending payouts must be settled first."],
};

export function SecurityCaseActionDialog({ securityCase, action, onClose, onCompleted }: { readonly securityCase: SecurityCaseDetail; readonly action: SecurityCaseAction | null; readonly onClose: () => void; readonly onCompleted: (updated: SecurityCaseDetail, action: SecurityCaseAction) => void }) {
  const mutation = useAdminMutation((input: { action: SecurityCaseAction; reason: string }) => decideSecurityCase(securityCase.id, {
    action: input.action, reason: input.reason, ...(input.action === "delete" ? { confirmUsername: securityCase.account.username } : {}),
  }));
  if (!action) return null;
  const isDestructive = action === "suspend" || action === "ban" || action === "delete";

  async function confirm(reason: string) {
    if (!action) return;
    const updated = await mutation.run({ action, reason });
    if (updated) onCompleted(updated, action);
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={`${securityActionLabels[action]} · security case`}
      description="Decide only after reading the timeline. Automation never bans or deletes accounts."
      consequences={consequences[action](securityCase.account.username)}
      confirmLabel={securityActionLabels[action]}
      tone={isDestructive ? "danger" : "default"}
      typedConfirmationText={action === "delete" ? securityCase.account.username : undefined}
      requiresStepUp
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirm}
      onClose={() => { mutation.clearError(); onClose(); }}
    />
  );
}
