"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TextField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import {
  fetchDeveloperAudit,
  fetchDeveloperApplications,
  reviewDeveloperApplication,
  updateDeveloperOrganizationQuota,
  type AdminDeveloperAuditEntry,
  type AdminDeveloperApplication,
} from "@/services/developerOpsApi.service";

type ReviewDecision = "approved" | "rejected" | "suspended";

function reviewActionLabel(decision: ReviewDecision) {
  if (decision === "approved") return "Approve";
  if (decision === "rejected") return "Reject";
  return "Suspend";
}

export function DeveloperOpsWorkspace() {
  const { can } = useAdminPermissions();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [auditCursor, setAuditCursor] = useState<string | undefined>();
  const [pendingReview, setPendingReview] = useState<{ readonly app: AdminDeveloperApplication; readonly decision: ReviewDecision } | null>(null);
  const [quotaOrganization, setQuotaOrganization] = useState<AdminDeveloperApplication | null>(null);
  const [quotaValue, setQuotaValue] = useState("");
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery(
    (signal) => fetchDeveloperApplications(statusFilter || undefined, signal),
    `developer-ops:${statusFilter}`,
  );
  const { data: auditData, error: auditError, errorMessage: auditErrorMessage, isLoading: isAuditLoading, reload: reloadAudit } = useAdminQuery(
    (signal) => fetchDeveloperAudit(auditCursor, signal),
    `developer-ops-audit:${auditCursor ?? "latest"}`,
    can("audit:read"),
  );

  async function handleReview(reason: string) {
    if (!pendingReview) return;
    const { app, decision } = pendingReview;
    setBusyId(app.id);
    setActionError(null);
    try {
      await reviewDeveloperApplication(app.id, decision, reason);
      setPendingReview(null);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update developer application.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleQuotaAdjustment(reason: string) {
    if (!quotaOrganization) return;
    setBusyId(quotaOrganization.id);
    setActionError(null);
    try {
      await updateDeveloperOrganizationQuota(quotaOrganization.organizationId, Number(quotaValue), reason);
      setQuotaOrganization(null);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not adjust the organization quota.");
    } finally {
      setBusyId(null);
    }
  }

  const columns: readonly DataTableColumn<AdminDeveloperApplication>[] = [
    { key: "org", header: "Organization", render: (app) => app.organizationName },
    { key: "name", header: "Application", render: (app) => app.name },
    { key: "product", header: "Product", render: (app) => app.apiProduct, isMono: true },
    { key: "status", header: "Status", render: (app) => <StatusBadge status={app.status} label={app.status} /> },
    { key: "quota", header: "Subscription / monthly quota", render: (app) => `${app.planTier} · ${app.subscriptionStatus} · ${app.monthlyQuota.toLocaleString()}` },
    {
      key: "actions",
      header: "Actions",
      render: (app) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="small" variant="primary" disabled={busyId !== null} isBusy={busyId === app.id} onClick={() => setPendingReview({ app, decision: "approved" })}>
            Approve
          </Button>
          <Button size="small" variant="ghost" disabled={busyId !== null} isBusy={busyId === app.id} onClick={() => setPendingReview({ app, decision: "rejected" })}>
            Reject
          </Button>
          <Button size="small" variant="danger" disabled={busyId !== null} isBusy={busyId === app.id} onClick={() => setPendingReview({ app, decision: "suspended" })}>
            Suspend
          </Button>
          {can("config:plans") && app.subscriptionStatus === "active" && app.planTier !== "sandbox" && app.paymentVerified ? <Button size="small" variant="secondary" disabled={busyId !== null} onClick={() => { setQuotaOrganization(app); setQuotaValue(String(app.monthlyQuota)); setActionError(null); }}>Adjust quota</Button> : null}
        </div>
      ),
    },
  ];
  const auditColumns: readonly DataTableColumn<AdminDeveloperAuditEntry>[] = [
    { key: "time", header: "Time", render: (entry) => new Date(entry.createdAt).toLocaleString() },
    { key: "organization", header: "Organization", render: (entry) => entry.organizationName },
    { key: "action", header: "Action", render: (entry) => entry.action, isMono: true },
    { key: "actor", header: "Actor", render: (entry) => `${entry.actorRole} · ${entry.actorAccountId}`, isMono: true },
    { key: "subject", header: "Subject", render: (entry) => `${entry.subjectType} · ${entry.subjectId}`, isMono: true },
  ];

  return (
    <>
      <PageHeader
        area="Platform"
        title="Developer applications"
        description="Review Business Messaging production access requests and enforce organization suspension or approval gates."
        actions={
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="small" variant={statusFilter === "" ? "primary" : "secondary"} onClick={() => setStatusFilter("")}>All</Button>
            <Button size="small" variant={statusFilter === "review_pending" ? "primary" : "secondary"} onClick={() => setStatusFilter("review_pending")}>Pending</Button>
            <Button size="small" variant={statusFilter === "approved" ? "primary" : "secondary"} onClick={() => setStatusFilter("approved")}>Approved</Button>
            <Button size="small" variant={statusFilter === "suspended" ? "primary" : "secondary"} onClick={() => setStatusFilter("suspended")}>Suspended</Button>
          </div>
        }
      />
      {error ? <ErrorBlock error={error} message={errorMessage ?? undefined} onRetry={reload} /> : null}
      {pendingReview ? (
        <ConfirmActionDialog
          intent="security"
          isOpen
          title={`${reviewActionLabel(pendingReview.decision)} ${pendingReview.app.name}?`}
          description={`Record why this production-access decision is being made for ${pendingReview.app.organizationName}.`}
          consequences={["This decision is audited and changes the application's production access state."]}
          confirmLabel={`${reviewActionLabel(pendingReview.decision)} application`}
          tone={pendingReview.decision === "approved" ? "default" : "danger"}
          requiresStepUp
          reasonLabel="Review reason (saved to the audit log)"
          reasonPlaceholder="Describe the evidence and decision basis."
          reasonHint="Enter 5–1000 characters. This reason is retained in the audit log."
          reasonMaximumLength={1000}
          isBusy={busyId === pendingReview.app.id}
          errorMessage={actionError}
          onConfirm={(reason) => void handleReview(reason)}
          onClose={() => {
            setActionError(null);
            setPendingReview(null);
          }}
        />
      ) : null}
      {quotaOrganization ? <ConfirmActionDialog
        intent="security"
        isOpen
        title={`Adjust ${quotaOrganization.organizationName} quota?`}
        description={`Current tier: ${quotaOrganization.planTier}; subscription: ${quotaOrganization.subscriptionStatus}. This changes only the existing subscription quota.`}
        consequences={["Requires a verified active paid subscription.", "Does not change the plan, payment status, or billing period.", "The change and reason are written atomically to the developer audit log."]}
        confirmLabel="Save quota"
        requiresStepUp
        reasonLabel="Adjustment reason (saved to the audit log)"
        reasonPlaceholder="Explain the approved quota adjustment."
        isBusy={busyId === quotaOrganization.id}
        errorMessage={actionError}
        isConfirmDisabled={!Number.isSafeInteger(Number(quotaValue)) || Number(quotaValue) < 100 || Number(quotaValue) === quotaOrganization.monthlyQuota}
        onConfirm={(reason) => void handleQuotaAdjustment(reason)}
        onClose={() => { setActionError(null); setQuotaOrganization(null); }}
      >
        <TextField label="Monthly API message quota" type="number" min={100} step={1} value={quotaValue} onChange={(event) => setQuotaValue(event.target.value)} inputMode="numeric" />
      </ConfirmActionDialog> : null}
      <Card isFlush>
        <DataTable
          caption="Developer applications"
          columns={columns}
          rows={data?.applications ?? []}
          readRowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No developer applications found. Developer production access requests submitted in the Developer Portal appear here."
        />
      </Card>
      {can("audit:read") ? <>
        <PageHeader area="Platform" title="Developer audit trail" description="Read-only history of developer application, organization and billing operations. Sensitive before/after payloads are not exposed here." actions={auditCursor ? <Button size="small" variant="secondary" onClick={() => setAuditCursor(undefined)}>Latest entries</Button> : undefined} />
        {auditError ? <ErrorBlock error={auditError} message={auditErrorMessage ?? undefined} onRetry={reloadAudit} /> : null}
        <Card isFlush>
          <DataTable caption="Developer audit entries" columns={auditColumns} rows={auditData?.entries ?? []} readRowKey={(row) => row.id} isLoading={isAuditLoading} emptyMessage="No developer audit events have been recorded." />
        </Card>
        {auditData?.nextCursor ? <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><Button size="small" variant="secondary" onClick={() => setAuditCursor(auditData.nextCursor)}>Older entries</Button></div> : null}
      </> : null}
    </>
  );
}
