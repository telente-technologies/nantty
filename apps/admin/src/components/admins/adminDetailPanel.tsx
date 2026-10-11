"use client";

import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { useAdminPermissions, useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { changeAdminAccountState, fetchAdminAccountDetail } from "@/services/platformApi.service";
import type { AdminAccountSummary } from "@/types/admin.type";
import { formatDateTime } from "@/utils/formatting.util";

import { PermissionSummary } from "./permissionChecklist";

type StateAction = "disable" | "enable" | "reset-mfa" | "suspend" | "revoke" | "approve";

const stateActionCopy: Record<StateAction, { title: string; confirmLabel: string; consequences: string[]; tone: "danger" | "default" }> = {
  disable: { title: "Disable this admin", confirmLabel: "Disable admin", tone: "danger", consequences: ["Every active session is signed out immediately.", "They cannot sign in until re-enabled.", "Their past actions stay in the audit log."] },
  suspend: { title: "Suspend this admin's access", confirmLabel: "Suspend access", tone: "danger", consequences: ["Every active session is killed immediately.", "They cannot sign in until a superadmin enables them again."] },
  revoke: { title: "Revoke this admin's access", confirmLabel: "Revoke access", tone: "danger", consequences: ["Every active session is killed immediately.", "Revoking is permanent. They would need a new invitation.", "Their past actions stay in the audit log."] },
  approve: { title: "Approve this superadmin", confirmLabel: "Approve superadmin", tone: "default", consequences: ["A second superadmin approves, so the invitation can now be sent.", "You cannot approve a superadmin you created."] },
  enable: { title: "Enable this admin", confirmLabel: "Enable admin", tone: "default", consequences: ["They can sign in again with their password and authenticator.", "Any lockout from failed attempts is cleared."] },
  "reset-mfa": { title: "Reset two-step verification", confirmLabel: "Reset MFA", tone: "danger", consequences: ["Their authenticator, passkeys and recovery codes stop working.", "Every active session is signed out.", "They must set up a new authenticator at next sign-in."] },
};

export function AdminDetailPanel({ adminId, onClose, onEditAccess, onChanged }: { readonly adminId: string; readonly onClose: () => void; readonly onEditAccess: (admin: AdminAccountSummary) => void; readonly onChanged: () => void }) {
  const { admin: signedInAdmin } = useAdminSession();
  const { isSuperadmin } = useAdminPermissions();
  const { showToast } = useToast();
  const detail = useAdminQuery((signal) => fetchAdminAccountDetail(adminId, signal), adminId);
  const [pendingAction, setPendingAction] = useState<StateAction | null>(null);
  const stateMutation = useAdminMutation((input: { action: StateAction; reason: string }) => changeAdminAccountState(adminId, input.action, input.reason));

  async function confirmStateAction(reason: string) {
    if (!pendingAction) return;
    const result = await stateMutation.run({ action: pendingAction, reason });
    if (!result) return;
    showToast(`${stateActionCopy[pendingAction].confirmLabel}: done for ${result.admin.name}.`);
    setPendingAction(null);
    detail.reload();
    onChanged();
  }

  const account = detail.data?.admin ?? null;
  const isProtected = account ? (account.role === "SUPERADMIN" && !isSuperadmin) || account.id === signedInAdmin.id || account.status === "REVOKED" : true;
  return (
    <SidePanel
      isOpen
      width="wide"
      onClose={onClose}
      title={account?.name ?? "Admin"}
      subtitle={account ? <span className="mono">{account.email}</span> : null}
      footer={
        account && !isProtected ? (
          <>
            {account.role !== "SUPERADMIN" ? <Button variant="primary" iconName="shield24" onClick={() => onEditAccess(account)}>Change access</Button> : null}
            {account.status === "PENDING_APPROVAL" ? <Button variant="primary" onClick={() => setPendingAction("approve")}>Approve superadmin</Button> : null}
            {account.status === "DISABLED" || account.status === "LOCKED" || account.status === "SUSPENDED" ? (
              <Button onClick={() => setPendingAction("enable")}>{account.status === "LOCKED" ? "Unlock" : "Enable"}</Button>
            ) : (
              <Button variant="quietDanger" onClick={() => setPendingAction("suspend")}>
                Suspend access
              </Button>
            )}
            <Button variant="danger" onClick={() => setPendingAction("revoke")}>Revoke</Button>
            <Button variant="quietDanger" onClick={() => setPendingAction("reset-mfa")}>
              Reset MFA
            </Button>
          </>
        ) : null
      }
    >
      {detail.errorMessage ? <ErrorBlock error={detail.error} message={detail.errorMessage} onRetry={detail.reload} /> : null}
      {detail.isLoading && !account ? <LoadingBlock /> : null}
      {account ? (
        <>
          {isProtected ? <NoticeBanner tone="info">{account.role === "SUPERADMIN" && !isSuperadmin ? "Only a superadmin can change a superadmin." : "This is your own account. Another superadmin must change it."}</NoticeBanner> : null}
          <KeyValueList
            columns={3}
            items={[
              { label: "Role", value: <StatusBadge status={account.role} hasDot={false} /> },
              { label: "Status", value: <StatusBadge status={account.status} /> },
              { label: "Two-step", value: account.mfaEnrolled ? `On${account.passkeyCount ? ` · ${account.passkeyCount} passkey(s)` : ""}` : "Not set up" },
              { label: "Last sign-in", value: formatDateTime(account.lastLoginAt) },
              { label: "Active sessions", value: detail.data?.activeSessionCount ?? 0 },
              { label: "Created", value: `${formatDateTime(account.createdAt)} by ${account.createdByName ?? "—"}` },
            ]}
          />
          <SectionHeading>Permissions</SectionHeading>
          {account.role === "SUPERADMIN" ? <p>Every permission, including managing admins.</p> : <PermissionSummary permissions={account.permissions} />}
          {account.roleNames.length > 0 ? <p>Roles: {account.roleNames.join(", ")}</p> : null}
          <SectionHeading>Last actions by {account.name}</SectionHeading>
          <AuditHistoryList entries={detail.data?.lastActions ?? []} />
          <SectionHeading>History of changes to this account</SectionHeading>
          <AuditHistoryList entries={detail.data?.history ?? []} />
        </>
      ) : null}
      {pendingAction ? (
        <ConfirmActionDialog intent="security"
          isOpen
          title={stateActionCopy[pendingAction].title}
          confirmLabel={stateActionCopy[pendingAction].confirmLabel}
          tone={stateActionCopy[pendingAction].tone}
          consequences={stateActionCopy[pendingAction].consequences}
          requiresStepUp
          isBusy={stateMutation.isRunning}
          errorMessage={stateMutation.errorMessage}
          onConfirm={confirmStateAction}
          onClose={() => {
            stateMutation.clearError();
            setPendingAction(null);
          }}
        />
      ) : null}
    </SidePanel>
  );
}
