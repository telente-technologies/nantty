"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCopyrightPolicy, updateCopyrightPolicy } from "@/services/copyrightPolicyApi.service";
import type { CopyrightPolicySettings } from "@/types/copyright.type";

type EditableField = keyof Omit<CopyrightPolicySettings, "updatedBy" | "updatedAt">;

const fields: readonly { readonly key: EditableField; readonly label: string; readonly min: number; readonly max: number }[] = [
  { key: "takedownDeadlineHours", label: "Takedown deadline (hours)", min: 1, max: 720 },
  { key: "strikeLifetimeDays", label: "Strike lifetime (days)", min: 7, max: 730 },
  { key: "warningLifetimeDays", label: "Warning kept on record (days)", min: 7, max: 730 },
  { key: "strikeWindowDays", label: "Strike counting window (days)", min: 7, max: 730 },
  { key: "restrictionThreshold", label: "Strikes before suspension (Nigerian law: repeat = 2 at most)", min: 1, max: 2 },
  { key: "suspensionReviewThreshold", label: "Strikes before suspension review", min: 1, max: 20 },
  { key: "restrictionDays", label: "Suspension length (days, legal minimum 30)", min: 30, max: 90 },
];

export function CopyrightPolicyCard() {
  const { data, reload } = useAdminQuery((signal) => fetchCopyrightPolicy(signal), "copyright-policy");
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<Record<EditableField, string> | null>(null);
  const mutation = useAdminMutation((input: { settings: CopyrightPolicySettings; reason: string }) => updateCopyrightPolicy(input.settings, input.reason));
  if (!data) return null;

  async function savePolicy(reason: string) {
    if (!draft) return;
    const settings = Object.fromEntries(fields.map((field) => [field.key, Number(draft[field.key])])) as unknown as CopyrightPolicySettings;
    if (!(await mutation.run({ settings, reason }))) return;
    setDraft(null);
    showToast("Copyright policy updated. Logged to the audit trail.");
    reload();
  }

  return (
    <Card title="Copyright policy" actions={can("copyright:review") ? <Button size="small" onClick={() => setDraft(Object.fromEntries(fields.map((field) => [field.key, String(data[field.key])])) as Record<EditableField, string>)}>Change policy</Button> : null}>
      <KeyValueList columns={3} items={fields.map((field) => ({ label: field.label, value: String(data[field.key]) }))} />
      <ConfirmActionDialog intent="copyright"
        isOpen={draft !== null}
        title="Change copyright policy"
        consequences={["New deadlines apply to warnings issued after this change.", "Strike thresholds apply the next time a strike is issued or expires."]}
        confirmLabel="Save policy"
        requiresStepUp
        isBusy={mutation.isRunning}
        errorMessage={mutation.errorMessage}
        onConfirm={savePolicy}
        onClose={() => { mutation.clearError(); setDraft(null); }}
      >
        {draft ? fields.map((field) => (
          <TextField key={field.key} label={`${field.label} (${field.min} to ${field.max})`} type="number" min={field.min} max={field.max} value={draft[field.key]} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />
        )) : null}
      </ConfirmActionDialog>
    </Card>
  );
}
