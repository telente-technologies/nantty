"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { CheckboxField, TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useIdempotencyKeyPerSubmission } from "@/hooks/useIdempotencyKeyPerSubmission.hook";
import { saveAdCashbackSettingForUser } from "@/services/adCreditApi.service";
import type { AdCashbackSetting } from "@/types/adCredit.type";
import { buildSubmissionSignature, defaultCashbackPercent, isCashbackPercentAllowed, maximumCashbackPercent, minimumCashbackPercent } from "@/utils/adCredit.util";

import { AdCreditUserPicker, type PickedAdCreditUser } from "./adCreditUserPicker";

export function AdCashbackEditorDialog({ existing, onClose, onSaved }: { readonly existing: AdCashbackSetting | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [pickedUser, setPickedUser] = useState<PickedAdCreditUser | null>(existing ? { id: existing.userId, username: existing.username, currency: null } : null);
  const [isEnabled, setIsEnabled] = useState(existing?.enabled ?? true);
  const [typedPercent, setTypedPercent] = useState(String(existing?.percent ?? defaultCashbackPercent));
  const keyForSubmission = useIdempotencyKeyPerSubmission();
  const mutation = useAdminMutation(saveAdCashbackSettingForUser);
  const percent = Number(typedPercent);
  const isPercentValid = isCashbackPercentAllowed(percent);
  const owner = pickedUser?.username ? `@${pickedUser.username}` : pickedUser?.id ?? "this user";

  async function confirmSave(reason: string) {
    if (!pickedUser || !isPercentValid) return;
    const saved = await mutation.run({ userId: pickedUser.id, enabled: isEnabled, percent, reason, idempotencyKey: keyForSubmission(buildSubmissionSignature([pickedUser.id, isEnabled, percent, reason])) });
    if (saved) {
      showToast(saved.enabled ? `${owner} now gets ${saved.percent}% of real-money ad spend back as ad credit` : `Cashback turned off for ${owner}`);
      onSaved();
      onClose();
    }
  }

  return (
    <ConfirmActionDialog
      isOpen
      title={existing ? `Edit cashback for ${owner}` : "Add a cashback user"}
      description="Cashback is paid as ad credit when ad spend settles. It is never paid on spend covered by ad credit, and it is reversed if that spend is refunded. Cashback credit never expires."
      confirmLabel={isEnabled ? `Save ${isPercentValid ? `${percent}% ` : ""}cashback` : "Turn cashback off"}
      requiresStepUp
      isConfirmDisabled={!pickedUser || !isPercentValid}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmSave}
      onClose={onClose}
    >
      {existing ? null : <AdCreditUserPicker pickedUser={pickedUser} onPick={setPickedUser} />}
      <CheckboxField label="Cashback on" description="Credit a share of each settled real-money ad spend back to this user." checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} />
      <TextField label="Cashback percent" type="number" inputMode="numeric" min={minimumCashbackPercent} max={maximumCashbackPercent} step={1} value={typedPercent} onChange={(event) => setTypedPercent(event.target.value)} error={typedPercent && !isPercentValid ? `Use a whole number from ${minimumCashbackPercent} to ${maximumCashbackPercent}.` : null} hint={`Default ${defaultCashbackPercent}%.`} />
    </ConfirmActionDialog>
  );
}
