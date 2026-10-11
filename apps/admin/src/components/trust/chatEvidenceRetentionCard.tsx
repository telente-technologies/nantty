"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchChatEvidenceRetention, updateChatEvidenceRetention } from "@/services/chatReportsApi.service";

import styles from "./chatEvidence.module.css";

export function ChatEvidenceRetentionCard() {
  const { data, reload } = useAdminQuery((signal) => fetchChatEvidenceRetention(signal), "chat-evidence-retention");
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [retentionDays, setRetentionDays] = useState("");
  const mutation = useAdminMutation((input: { retentionDays: number; reason: string }) => updateChatEvidenceRetention(input));
  if (!data) return null;

  async function saveRetention(reason: string) {
    const saved = await mutation.run({ retentionDays: Number(retentionDays), reason });
    if (!saved) return;
    setIsEditing(false);
    showToast("Evidence retention updated. Logged to the audit trail.");
    reload();
  }

  return (
    <Card title="Submitted evidence retention">
      <div className={styles.retentionRow}>
        <span className={styles.legalTag}>{data.label}</span>
        <span>Kept {data.retentionDays} days after the report is closed. Reports escalated to legal are held {data.legalHoldDays} days.</span>
        {can("chat-reports:legal") ? <Button size="small" onClick={() => { setRetentionDays(String(data.retentionDays)); setIsEditing(true); }}>Change retention</Button> : null}
      </div>
      <ConfirmActionDialog intent="settings"
        isOpen={isEditing}
        title="Change evidence retention"
        consequences={["Applies to evidence submitted from now on and to reports closed after this change.", "Legal holds are not shortened."]}
        confirmLabel="Save retention"
        requiresStepUp
        isBusy={mutation.isRunning}
        errorMessage={mutation.errorMessage}
        isConfirmDisabled={!retentionDays}
        onConfirm={saveRetention}
        onClose={() => { mutation.clearError(); setIsEditing(false); }}
      >
        <TextField label="Days to keep (30 to 730)" type="number" min={30} max={730} value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
      </ConfirmActionDialog>
    </Card>
  );
}
