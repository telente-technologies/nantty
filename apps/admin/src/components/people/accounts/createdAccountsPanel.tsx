"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdminCreatedAccounts } from "@/services/safetyApi.service";
import type { AdminCreatedAccount } from "@/types/accountsAdmin.type";
import { formatDateTime } from "@/utils/formatting.util";

import { CreateAccountDialog } from "./createAccountDialog";

const columns: readonly DataTableColumn<AdminCreatedAccount>[] = [
  { key: "user", header: "Account", render: (item) => <UserIdentity user={item.user} size={24} /> },
  { key: "profile", header: "Profile", render: (item) => item.profileType.charAt(0) + item.profileType.slice(1).toLowerCase() },
  { key: "password", header: "Password", render: (item) => item.mustChangePassword ? <StatusBadge tone="caution" label="Change on first login" hasDot={false} /> : <StatusBadge tone="success" label="Changed" hasDot={false} /> },
  { key: "reserved", header: "Reserved check", render: (item) => item.bypassedReservedEntries.length > 0 ? `Bypassed: ${item.bypassedReservedEntries.join(", ")}` : "Not needed" },
  { key: "by", header: "Created by", render: (item) => `${item.createdByName} · ${formatDateTime(item.createdAt)}` },
  { key: "reason", header: "Reason", render: (item) => item.reason },
];

export function CreatedAccountsPanel() {
  const { isSuperadmin } = useAdminPermissions();
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchAdminCreatedAccounts(signal), "created");
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" iconName="shield24" disabled={!isSuperadmin} onClick={() => setIsCreateOpen(true)}>{isSuperadmin ? "Create an account" : "Superadmin only"}</Button>
      </div>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Accounts created by admins" columns={columns} rows={data?.items ?? []} readRowKey={(item) => item.id} isLoading={isLoading} emptyMessage="No admin-created accounts yet." />
      {isCreateOpen ? <CreateAccountDialog onClose={() => setIsCreateOpen(false)} onCreated={(account) => { setIsCreateOpen(false); showToast(`@${account.user.username} created. They must change the password at first sign-in.`); reload(); }} /> : null}
    </>
  );
}
