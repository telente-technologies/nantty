"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdminAccounts } from "@/services/platformApi.service";
import type { AdminAccountSummary } from "@/types/admin.type";
import { formatRelativeTimeFromNow } from "@/utils/formatting.util";

import { StaffSettingsBar } from "./staffSettingsBar";
import { AdminAccessDialog } from "./adminAccessDialog";
import { AdminDetailPanel } from "./adminDetailPanel";

const columns: readonly DataTableColumn<AdminAccountSummary>[] = [
  { key: "name", header: "Admin", render: (admin) => <span><strong>{admin.name}</strong><br /><span className="mono">{admin.email}</span></span> },
  { key: "role", header: "Role", render: (admin) => <StatusBadge status={admin.role} hasDot={false} />, width: "120px" },
  { key: "status", header: "Status", render: (admin) => <StatusBadge status={admin.status} />, width: "110px" },
  { key: "permissions", header: "Permissions", render: (admin) => (admin.role === "SUPERADMIN" ? "All" : `${admin.roleNames.length > 0 ? `${admin.roleNames.join(", ")} · ` : ""}${admin.permissions.length} granted`), width: "120px" },
  { key: "mfa", header: "Two-step", render: (admin) => (admin.mfaEnrolled ? "On" : <StatusBadge label="Not set up" tone="caution" />), width: "110px" },
  { key: "lastLogin", header: "Last sign-in", render: (admin) => formatRelativeTimeFromNow(admin.lastLoginAt), width: "130px" },
];

export function AdminsWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [accessDialogAdmin, setAccessDialogAdmin] = useState<AdminAccountSummary | null | "new">(null);
  const [detailRefreshCount, setDetailRefreshCount] = useState(0);
  const list = useAdminQuery((signal) => fetchAdminAccounts({ search, status, cursor }, signal), `${search}|${status}|${cursor ?? ""}`);

  return (
    <>
      <PageHeader
        area="Platform · staff"
        title="Admins & roles"
        description="Who can operate Nantty, and exactly what each person may do. Every change here needs your authenticator code."
        actions={
          <Button variant="primary" iconName="plus16" onClick={() => setAccessDialogAdmin("new")}>
            Invite admin
          </Button>
        }
      />
      <StaffSettingsBar />
      <Toolbar>
        <TextField label="Search admins" isLabelHidden placeholder="Search by name or email" value={search} onChange={(event) => { setSearch(event.target.value); setCursor(undefined); }} />
        <SelectField label="Status" isLabelHidden value={status} onChange={(event) => { setStatus(event.target.value); setCursor(undefined); }} options={[{ value: "", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "INVITED", label: "Invited" }, { value: "DISABLED", label: "Disabled" }, { value: "SUSPENDED", label: "Suspended" }, { value: "REVOKED", label: "Revoked" }, { value: "PENDING_APPROVAL", label: "Awaiting approval" }]} />
      </Toolbar>
      {list.errorMessage ? <ErrorBlock error={list.error} message={list.errorMessage} onRetry={list.reload} /> : null}
      <DataTable caption="Admin accounts" columns={columns} rows={list.data?.items ?? []} readRowKey={(admin) => admin.id} isLoading={list.isLoading} onRowOpen={(admin) => setSelectedAdminId(admin.id)} selectedRowKey={selectedAdminId} />
      <CursorPagination cursor={cursor} nextCursor={list.data?.nextCursor} onCursorChange={setCursor} />
      {selectedAdminId ? <AdminDetailPanel key={`${selectedAdminId}-${detailRefreshCount}`} adminId={selectedAdminId} onClose={() => setSelectedAdminId(null)} onEditAccess={(admin) => setAccessDialogAdmin(admin)} onChanged={list.reload} /> : null}
      {accessDialogAdmin ? (
        <AdminAccessDialog
          existingAdmin={accessDialogAdmin === "new" ? null : accessDialogAdmin}
          onClose={() => setAccessDialogAdmin(null)}
          onSaved={(saved) => {
            setAccessDialogAdmin(null);
            setSelectedAdminId(saved.id);
            setDetailRefreshCount((count) => count + 1);
            list.reload();
          }}
        />
      ) : null}
    </>
  );
}
