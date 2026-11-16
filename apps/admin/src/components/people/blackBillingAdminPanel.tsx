"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { controlAdminGovernmentBlack, fetchAdminGovernmentBlack } from "@/services/safetyApi.service";
import type { AdminGovernmentBlackSummary } from "@/types/blackApplications.type";
import { formatDateOnly, formatMoneyForDisplay } from "@/utils/formatting.util";

export function BlackBillingAdminPanel() {
  const { showToast } = useToast();
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchAdminGovernmentBlack(signal), "government-black-billing");
  const [action, setAction] = useState<{ subscriptionId: string; kind: "pause" | "cancel" } | null>(null);
  const controlMutation = useAdminMutation((input: { subscriptionId: string; kind: "pause" | "cancel" | "retry" | "reconcile"; reason?: string }) =>
    controlAdminGovernmentBlack(input.subscriptionId, input.kind, input.reason),
  );

  const columns: readonly DataTableColumn<AdminGovernmentBlackSummary>[] = [
    { key: "agency", header: "Organization", render: (row) => row.verification ? `${row.verification.agencyName} (@${row.verification.handle})` : row.subscription.profileId },
    { key: "jurisdiction", header: "Jurisdiction", isMono: true, render: (row) => row.verification?.jurisdictionCountryCode ?? "—" },
    { key: "price", header: "Monthly USD", render: (row) => formatMoneyForDisplay(row.subscription.price) },
    { key: "card", header: "Recurring card", render: (row) => row.subscription.cardLabel ? `${row.subscription.cardLabel}${row.subscription.cardUsable ? "" : " (unusable)"}` : "Missing" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.subscription.status.toUpperCase()} /> },
    { key: "next", header: "Next charge", render: (row) => row.subscription.nextChargeAt ? formatDateOnly(row.subscription.nextChargeAt) : "—" },
    {
      key: "actions",
      header: "Controls",
      render: (row) => (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <Button size="small" variant="ghost" onClick={async () => { await controlMutation.run({ subscriptionId: row.subscription.subscriptionId, kind: "reconcile" }); showToast("Reconciled with payment provider."); reload(); }}>Reconcile</Button>
          <Button size="small" variant="ghost" onClick={async () => { await controlMutation.run({ subscriptionId: row.subscription.subscriptionId, kind: "retry" }); showToast("Renewal charge retried."); reload(); }}>Retry</Button>
          {row.subscription.status !== "paused" ? <Button size="small" variant="secondary" onClick={() => setAction({ subscriptionId: row.subscription.subscriptionId, kind: "pause" })}>Pause</Button> : null}
          {row.subscription.status !== "canceled" ? <Button size="small" variant="quietDanger" onClick={() => setAction({ subscriptionId: row.subscription.subscriptionId, kind: "cancel" })}>Cancel</Button> : null}
        </div>
      ),
    },
  ];

  return (
    <Card title="Government Black USD billing & reconciliation">
      <NoticeBanner tone="info" title="Monthly USD recurring card billing">
        Black Government subscriptions bill monthly in USD ($300 Nigeria / $500 international) from the verified legal jurisdiction. Removing a saved card pauses entitlement immediately; failed renewals never grant unpaid extensions beyond paid coverage.
      </NoticeBanner>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Government Black subscriptions"
        columns={columns}
        rows={data?.items ?? []}
        readRowKey={(row) => row.subscription.subscriptionId}
        isLoading={isLoading}
        emptyMessage="No Black Government subscriptions found."
      />
      {action ? (
        <ConfirmActionDialog
          intent="verify"
          isOpen
          tone={action.kind === "cancel" ? "danger" : "default"}
          title={action.kind === "pause" ? "Pause Black subscription" : "Cancel Black subscription"}
          consequences={action.kind === "pause" ? ["Badge visibility is paused immediately."] : ["Subscription and Black entitlement are cancelled immediately."]}
          confirmLabel={action.kind === "pause" ? "Pause" : "Cancel"}
          requiresStepUp
          isBusy={controlMutation.isRunning}
          errorMessage={controlMutation.errorMessage}
          onConfirm={async (reason) => {
            await controlMutation.run({ subscriptionId: action.subscriptionId, kind: action.kind, reason });
            showToast(action.kind === "pause" ? "Subscription paused." : "Subscription cancelled.");
            setAction(null);
            reload();
          }}
          onClose={() => { controlMutation.clearError(); setAction(null); }}
        />
      ) : null}
    </Card>
  );
}
