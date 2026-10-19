"use client";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useIdempotencyKeyPerSubmission } from "@/hooks/useIdempotencyKeyPerSubmission.hook";
import { revokeUnspentAdCredit } from "@/services/adCreditApi.service";
import type { AdCreditGrant } from "@/types/adCredit.type";
import { buildSubmissionSignature } from "@/utils/adCredit.util";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

export function RevokeAdCreditDialog({ credit, onClose, onRevoked }: { readonly credit: AdCreditGrant | null; readonly onClose: () => void; readonly onRevoked: () => void }) {
  const { showToast } = useToast();
  const keyForSubmission = useIdempotencyKeyPerSubmission();
  const mutation = useAdminMutation(revokeUnspentAdCredit);
  if (!credit) return null;
  const owner = credit.username ? `@${credit.username}` : credit.userId;

  async function confirmRevoke(reason: string) {
    if (!credit) return;
    const revoked = await mutation.run({ creditId: credit.id, reason, idempotencyKey: keyForSubmission(buildSubmissionSignature([credit.id, reason])) });
    if (revoked) {
      showToast(`Removed ${formatMoneyForDisplay(revoked.revokedAmount ?? credit.remaining)} of unspent ad credit from ${owner}`);
      onRevoked();
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={`Revoke ad credit for ${owner}`}
      description={`This removes the unspent ${formatMoneyForDisplay(credit.remaining)} of the ${formatMoneyForDisplay(credit.amount)} issued.`}
      consequences={["Credit already spent on ads is not touched.", "Ads paid from this credit keep running only while other credit or balance covers them."]}
      confirmLabel={`Remove ${formatMoneyForDisplay(credit.remaining)}`}
      tone="danger"
      requiresStepUp
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmRevoke}
      onClose={onClose}
    />
  );
}
