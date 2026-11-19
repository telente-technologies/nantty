"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import {
  fetchDeveloperApplications,
  reviewDeveloperApplication,
  type AdminDeveloperApplication,
} from "@/services/developerOpsApi.service";

export function DeveloperOpsWorkspace() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery(
    (signal) => fetchDeveloperApplications(statusFilter || undefined, signal),
    `developer-ops:${statusFilter}`,
  );

  async function handleReview(app: AdminDeveloperApplication, decision: "approved" | "rejected" | "suspended") {
    setBusyId(app.id);
    setActionError(null);
    try {
      await reviewDeveloperApplication(app.id, decision, `Admin ${decision} from Developer Operations`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update developer application.");
    } finally {
      setBusyId(null);
    }
  }

  const columns: readonly DataTableColumn<AdminDeveloperApplication>[] = [
    { key: "org", header: "Organization", render: (app) => app.organizationName },
    { key: "name", header: "Application", render: (app) => app.name },
    { key: "product", header: "Product", render: (app) => app.apiProduct, isMono: true },
    { key: "status", header: "Status", render: (app) => <StatusBadge status={app.status} label={app.status} /> },
    {
      key: "actions",
      header: "Actions",
      render: (app) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="small" variant="primary" isBusy={busyId === app.id} onClick={() => void handleReview(app, "approved")}>
            Approve
          </Button>
          <Button size="small" variant="ghost" isBusy={busyId === app.id} onClick={() => void handleReview(app, "rejected")}>
            Reject
          </Button>
          <Button size="small" variant="danger" isBusy={busyId === app.id} onClick={() => void handleReview(app, "suspended")}>
            Suspend
          </Button>
        </div>
      ),
    },
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
      {actionError ? <ErrorBlock message={actionError} /> : null}
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
    </>
  );
}
