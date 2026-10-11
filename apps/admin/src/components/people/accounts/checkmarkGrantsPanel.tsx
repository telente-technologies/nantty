"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { VerificationBadge } from "@/components/ui/verificationBadge";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCheckmarkGrants, grantLifetimeCheckmark, revokeLifetimeCheckmark } from "@/services/safetyApi.service";
import type { CheckmarkGrant } from "@/types/accountsAdmin.type";
import type { VerificationColor } from "@/types/platformUser.type";
import { formatDateOnly, humanizeConstantName } from "@/utils/formatting.util";

const statusTabs = [{ key: "ACTIVE", label: "Active" }, { key: "REVOKED", label: "Revoked" }] as const;
const colorOptions = [{ value: "BLUE", label: "Blue (personal)" }, { value: "GOLD", label: "Gold (business)" }, { value: "BLACK", label: "Black (official, admin-only)" }];

export function CheckmarkGrantsPanel() {
  const { isSuperadmin } = useAdminPermissions();
  const { showToast } = useToast();
  const [status, setStatus] = useState<"ACTIVE" | "REVOKED">("ACTIVE");
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [toRevoke, setToRevoke] = useState<CheckmarkGrant | null>(null);
  const [username, setUsername] = useState("");
  const [color, setColor] = useState<VerificationColor>("BLUE");
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchCheckmarkGrants(status, signal), status);
  const grantMutation = useAdminMutation((reason: string) => grantLifetimeCheckmark({ username, color, reason }));
  const revokeMutation = useAdminMutation((input: { grant: CheckmarkGrant; reason: string }) => revokeLifetimeCheckmark(input.grant.id, input.reason));

  async function grant(reason: string) {
    if (await grantMutation.run(reason)) {
      showToast(`Lifetime ${humanizeConstantName(color)} checkmark granted for @${username}.`);
      setIsGrantOpen(false);
      setUsername("");
      reload();
    }
  }

  async function revoke(reason: string) {
    if (toRevoke && (await revokeMutation.run({ grant: toRevoke, reason }))) {
      showToast("Checkmark revoked. Logged to the audit trail.");
      setToRevoke(null);
      reload();
    }
  }

  const columns: readonly DataTableColumn<CheckmarkGrant>[] = [
    { key: "user", header: "Account", render: (item) => <UserIdentity user={item.user} size={24} /> },
    { key: "color", header: "Checkmark", render: (item) => <VerificationBadge verification={{ color: item.color, tier: item.color === "BLUE" ? "VERIFIED" : item.color === "GOLD" ? "PRO" : "OFFICIAL", status: "VERIFIED", badgeVisible: true }} isLabelShown /> },
    { key: "reason", header: "Reason", render: (item) => item.revokedReason ? `${item.reason} (revoked: ${item.revokedReason})` : item.reason },
    { key: "by", header: "Granted by", render: (item) => `${item.grantedByName} · ${formatDateOnly(item.grantedAt)}` },
    { key: "actions", header: "", align: "end", width: "110px", render: (item) => item.revokedAt ? null : <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setToRevoke(item)}>Revoke</Button> },
  ];

  return (
    <>
      <NoticeBanner tone="info" title="Free for life">A granted checkmark never bills and never expires. It stays until an admin revokes it. Black is never sold or suggested, so only a superadmin can grant it.</NoticeBanner>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SegmentedTabs label="Grant status" items={statusTabs} activeKey={status} onChange={setStatus} />
        <Button variant="primary" iconName="shield24" onClick={() => setIsGrantOpen(true)}>Grant a checkmark</Button>
      </div>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Lifetime checkmark grants" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} isLoading={isLoading} emptyMessage={status === "ACTIVE" ? "No free checkmarks granted yet." : "Nothing revoked."} />
      {isGrantOpen ? (
        <ConfirmActionDialog intent="verify" isOpen title="Grant a lifetime free checkmark" confirmLabel="Grant checkmark" requiresStepUp reasonLabel="Reason (saved to the audit log)" isConfirmDisabled={username.trim().length < 3} isBusy={grantMutation.isRunning} errorMessage={grantMutation.errorMessage} onConfirm={grant} onClose={() => { grantMutation.clearError(); setIsGrantOpen(false); }}>
          <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value.replace(/^@/, ""))} autoComplete="off" error={readIssueMessageForField(grantMutation.validationIssues, "username")} />
          <SelectField label="Checkmark" hint="Must match the profile type: Blue for personal (including creator accounts), Gold for business or brand, Black for government." value={color} onChange={(event) => setColor(event.target.value as VerificationColor)} options={colorOptions.filter((option) => option.value !== "BLACK" || isSuperadmin)} />
        </ConfirmActionDialog>
      ) : null}
      {toRevoke ? <ConfirmActionDialog intent="verify" isOpen title="Revoke this checkmark" consequences={[`@${toRevoke.user.username} loses the ${humanizeConstantName(toRevoke.color)} badge straight away.`, "Any verification they held before the grant is restored."]} confirmLabel="Revoke checkmark" tone="danger" requiresStepUp isBusy={revokeMutation.isRunning} errorMessage={revokeMutation.errorMessage} onConfirm={revoke} onClose={() => { revokeMutation.clearError(); setToRevoke(null); }} /> : null}
    </>
  );
}
