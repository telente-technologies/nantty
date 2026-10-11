"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { policySeverityOptions } from "@/constants/trustOptions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createAdPolicyCategory, updateAdPolicyCategory } from "@/services/adsReviewApi.service";
import type { AdPolicyCategory, PolicySeverity } from "@/types/adsReview.type";

export function AdPolicyEditorDialog({ policy, onClose, onSaved }: { readonly policy: AdPolicyCategory | "new"; readonly onClose: () => void; readonly onSaved: (saved: AdPolicyCategory) => void }) {
  const existing = policy === "new" ? null : policy;
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [severity, setSeverity] = useState<PolicySeverity>(existing?.severity ?? "MEDIUM");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [reason, setReason] = useState("");
  const mutation = useAdminMutation(() => (existing ? updateAdPolicyCategory(existing.id, { name, description, severity, isActive, reason }) : createAdPolicyCategory({ name, description, severity })));

  async function savePolicy() {
    const saved = await mutation.run(undefined);
    if (saved) onSaved(saved);
  }

  const canSave = name.trim().length >= 3 && description.trim().length >= 10 && (!existing || reason.trim().length >= 5);
  return (
    <ModalDialog intent="ads"
      isOpen
      title={existing ? `Edit “${existing.name}”` : "New policy category"}
      description="Reviewers pick a category when they reject an ad; advertisers see its name and description."
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={savePolicy} isBusy={mutation.isRunning} disabled={!canSave}>{existing ? "Save changes" : "Create category"}</Button></>}
    >
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} error={readIssueMessageForField(mutation.validationIssues, "name")} />
      <TextAreaField label="What it covers" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={400} rows={3} error={readIssueMessageForField(mutation.validationIssues, "description")} />
      <SelectField label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value as PolicySeverity)} options={policySeverityOptions} />
      {existing ? (
        <>
          <CheckboxField label="Active" description="Inactive categories can't be chosen for new rejections." checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          <TextAreaField label="Reason for this change (saved to the audit log)" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={1000} />
        </>
      ) : null}
      {mutation.errorMessage ? <InlineError message={mutation.errorMessage} /> : null}
    </ModalDialog>
  );
}
