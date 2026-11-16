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

type ControlActionKind = "pause" | "cancel" | "retry" | "reconcile";

const actionDialogConfig: Record<
  ControlActionKind,
  {
    readonly title: string;
    readonly consequences: readonly string[];
    readonly confirmLabel: string;
    readonly tone: "default" | "danger";
    readonly successMessage: string;
  }
> = {
  reconcile: {
    title: "Reconcile with payment provider",
    consequences: ["Verifies the latest period status with the payment provider and settles confirmed charges."],
    confirmLabel: "Reconcile",
    tone: "default",
    successMessage: "Reconciled with payment provider.",
  },
  retry: {
    title: "Retry renewal charge",
    consequences: ["Initiates a manual renewal charge attempt against the saved USD recurring card."],
    confirmLabel: "Retry charge",
    tone: "default",
    successMessage: "Renewal charge retried.",
  },
  pause: {
    title: "Pause Black subscription",
    consequences: ["Badge visibility is paused immediately."],
    confirmLabel: "Pause",
    tone: "default",
    successMessage: "Subscription paused.",
  },
  cancel: {
    title: "Cancel Black subscription",
    consequences: ["Subscription and Black entitlement are cancelled immediately."],
    confirmLabel: "Cancel",
    tone: "danger",
    successMessage: "Subscription cancelled.",
  },
};

export function BlackBillingAdminPanel() {
  const { showToast } = useToast();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const { data, error, errorMessage, isLoading, reload } = useAdminQuery(
    (signal) => fetchAdminGovernmentBlack(cursor ? { cursor } : undefined, signal),
    `government-black-billing:${cursor ?? "first"}`,
  );
  const [action, setAction] = useState<{ subscriptionId: string; kind: ControlActionKind } | null>(null);
  const controlMutation = useAdminMutation((input: { subscriptionId: string; kind: ControlActionKind; reason: string }) =>
    controlAdminGovernmentBlack(input.subscriptionId, input.kind, input.reason),
  );

  function openAction(subscriptionId: string, kind: ControlActionKind) {
    controlMutation.clearError();
    setAction({ subscriptionId, kind });
  }

  const columns: readonly DataTableColumn<AdminGovernmentBlackSummary>[] = [
    { key: "agency", header: "Organization", render: (row) => (row.verification ? `${row.verification.agencyName} (@${row.verification.handle})` : row.subscription.profileId) },
    { key: "jurisdiction", header: "Jurisdiction", isMono: true, render: (row) => row.verification?.jurisdictionCountryCode ?? "—" },
    { key: "price", header: "Monthly USD", render: (row) => formatMoneyForDisplay(row.subscription.price) },
    { key: "card", header: "Recurring card", render: (row) => (row.subscription.cardLabel ? `${row.subscription.cardLabel}${row.subscription.cardUsable ? "" : " (unusable)"}` : "Missing") },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.subscription.status.toUpperCase()} /> },
    { key: "next", header: "Next charge", render: (row) => (row.subscription.nextChargeAt ? formatDateOnly(row.subscription.nextChargeAt) : "—") },
    {
      key: "actions",
      header: "Controls",
      render: (row) => (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <Button size="small" variant="ghost" onClick={() => openAction(row.subscription.subscriptionId, "reconcile")}>Reconcile</Button>
          <Button size="small" variant="ghost" onClick={() => openAction(row.subscription.subscriptionId, "retry")}>Retry</Button>
          {row.subscription.status !== "paused" ? <Button size="small" variant="secondary" onClick={() => openAction(row.subscription.subscriptionId, "pause")}>Pause</Button> : null}
          {row.subscription.status !== "canceled" ? <Button size="small" variant="quietDanger" onClick={() => openAction(row.subscription.subscriptionId, "cancel")}>Cancel</Button> : null}
        </div>
      ),
    },
  ];

  const activeConfig = action ? actionDialogConfig[action.kind] : null;

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
      {(cursor || data?.nextCursor) ? (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          {cursor ? <Button size="small" variant="ghost" onClick={() => setCursor(undefined)}>First page</Button> : null}
          {data?.nextCursor ? <Button size="small" variant="secondary" onClick={() => setCursor(data.nextCursor ?? undefined)}>Next page</Button> : null}
        </div>
      ) : null}
      {action && activeConfig ? (
        <ConfirmActionDialog
          intent="verify"
          isOpen
          tone={activeConfig.tone}
          title={activeConfig.title}
          consequences={activeConfig.consequences}
          confirmLabel={activeConfig.confirmLabel}
          requiresStepUp
          isBusy={controlMutation.isRunning}
          errorMessage={controlMutation.errorMessage}
          onConfirm={async (reason) => {
            const result = await controlMutation.run({ subscriptionId: action.subscriptionId, kind: action.kind, reason });
            if (!result) return;
            showToast(activeConfig.successMessage);
            setAction(null);
            reload();
          }}
          onClose={() => {
            controlMutation.clearError();
            setAction(null);
          }}
        />
      ) : null}
    </Card>
  );
}
