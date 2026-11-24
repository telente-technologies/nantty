"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchRetentionPolicies, updateRetentionPolicy, type RetentionPolicyRecord } from "@/services/configurationApi.service";
import { formatDateOnly, humanizeConstantName } from "@/utils/formatting.util";

export function RetentionPoliciesSection({ canWrite }: { readonly canWrite: boolean }) {
  const { showToast } = useToast();
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchRetentionPolicies(signal), "retention-policies");
  const [editing, setEditing] = useState<RetentionPolicyRecord | null>(null);
  const [action, setAction] = useState<RetentionPolicyRecord["action"]>("delete");
  const [retentionDays, setRetentionDays] = useState("30");
  const mutation = useAdminMutation((input: { category: string; reason: string; expectedVersion: number }) =>
    updateRetentionPolicy(input.category, {
      action,
      retentionDays: retentionDays.trim() === "" ? null : Number(retentionDays),
      needsLegalReview: action === "retain",
      expectedVersion: input.expectedVersion,
      reason: input.reason,
    }),
  );

  function openEditor(row: RetentionPolicyRecord) {
    setEditing(row);
    setAction(row.action);
    setRetentionDays(row.retentionDays === null ? "" : String(row.retentionDays));
  }

  async function confirmUpdate(reason: string) {
    if (!editing) return;
    const saved = await mutation.run({ category: editing.category, reason, expectedVersion: editing.version });
    if (!saved) return;
    showToast(`Updated retention policy for ${humanizeConstantName(saved.category)}.`);
    setEditing(null);
    reload();
  }

  const columns: readonly DataTableColumn<RetentionPolicyRecord>[] = [
    { key: "category", header: "Data category", render: (row) => <strong>{humanizeConstantName(row.category)}</strong> },
    { key: "action", header: "Action", render: (row) => <StatusBadge label={humanizeConstantName(row.action)} tone={row.action === "delete" ? "danger" : row.action === "anonymize" ? "caution" : "neutral"} /> },
    { key: "days", header: "Retention", align: "end", isMono: true, render: (row) => (row.retentionDays === null ? "Statutory" : `${row.retentionDays}d`) },
    { key: "version", header: "Version", align: "end", isMono: true, render: (row) => `v${row.version}` },
    { key: "updatedAt", header: "Updated", render: (row) => formatDateOnly(row.updatedAt) },
    { key: "edit", header: "Action", render: (row) => (canWrite ? <Button size="small" variant="secondary" onClick={() => openEditor(row)}>Edit</Button> : null) },
  ];

  return (
    <>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Account deletion retention policies" columns={columns} rows={data?.data ?? []} readRowKey={(row) => row.category} isLoading={isLoading} emptyMessage="No retention policies loaded." />
      <ConfirmActionDialog
        isOpen={editing !== null}
        title={editing ? `Edit retention: ${humanizeConstantName(editing.category)}` : "Edit retention policy"}
        consequences={["Changes the statutory retention snapshot attached to new account deletion requests.", "Requires step-up verification and a reason."]}
        confirmLabel="Save retention policy"
        requiresReason
        requiresStepUp
        isBusy={mutation.isRunning}
        errorMessage={mutation.errorMessage}
        onConfirm={confirmUpdate}
        onClose={() => { mutation.clearError(); setEditing(null); }}
      >
        {editing ? (
          <div style={{ display: "grid", gap: 12 }}>
            <SelectField
              label="Lifecycle action"
              value={action}
              onChange={(event) => setAction(event.target.value as RetentionPolicyRecord["action"])}
              options={[
                { value: "delete", label: "Delete" },
                { value: "anonymize", label: "Anonymize" },
                { value: "retain", label: "Retain (statutory)" },
              ]}
            />
            <TextField label="Retention days" type="number" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
          </div>
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
