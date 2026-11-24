"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { SectionHeading, Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchFinanceIssues, fetchSellerReserves, fetchStuckPayoutAccounts, releaseSellerReserve, retryPayoutAccountJob, runProviderBalanceReconciliation, sendPayoutVerificationPrompt } from "@/services/financeApi.service";
import type { FinanceIssue, ProviderMirrorReport, SellerReserveHold, StuckPayoutAccount } from "@/types/finance.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./finance.module.css";
import { FinanceExportDialog } from "./financeExportDialog";

const queueOptions = [
  { value: "", label: "All issue queues" },
  { value: "stuck_escrows", label: "Stuck escrows" },
  { value: "open_disputes", label: "Open disputes (>48h)" },
  { value: "aged_processing_payouts", label: "Aged processing payouts (>1h)" },
  { value: "pending_review_payouts", label: "Pending review payouts (>24h)" },
  { value: "failed_payments", label: "Failed payments (7d)" },
  { value: "seller_debt_accounts", label: "Seller debt accounts" },
];

export function FinanceIssuesWorkspace() {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [queue, setQueue] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingPayoutAction, setPendingPayoutAction] = useState<{ type: "retry"; jobId: string } | { type: "prompt"; userId: string } | null>(null);
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery(
    (signal) => fetchFinanceIssues({ queue: queue || undefined, limit: 100 }, signal),
    queue,
  );
  const canManagePayoutAccounts = can("payments:wallets");
  const canManageSellerReserves = can("payouts:approve");
  const [releasingSellerId, setReleasingSellerId] = useState<string | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<ProviderMirrorReport | null>(null);
  const stuckAccounts = useAdminQuery(
    (signal) => (canManagePayoutAccounts ? fetchStuckPayoutAccounts(50, signal) : Promise.resolve({ data: [], nextCursor: null })),
    `stuck-payout-accounts-${canManagePayoutAccounts}`,
  );
  const sellerReserves = useAdminQuery(
    (signal) => (canManageSellerReserves ? fetchSellerReserves(50, signal) : Promise.resolve({ data: [], nextCursor: null })),
    `seller-reserves-${canManageSellerReserves}`,
  );
  const payoutActionMutation = useAdminMutation((input: { action: { type: "retry"; jobId: string } | { type: "prompt"; userId: string }; reason: string }) =>
    input.action.type === "retry" ? retryPayoutAccountJob(input.action.jobId, input.reason) : sendPayoutVerificationPrompt(input.action.userId, input.reason),
  );
  const releaseReserveMutation = useAdminMutation((input: { sellerUserId: string; reason: string }) => releaseSellerReserve(input.sellerUserId, input.reason));
  const reconcileMutation = useAdminMutation((reason: string) => runProviderBalanceReconciliation(reason));

  async function confirmReconcile(reason: string) {
    const report = await reconcileMutation.run(reason);
    if (!report) return;
    setReconcileReport(report);
    setReconcileOpen(false);
    showToast(report.balanceBreaks.length === 0 && report.failures === 0 ? "Provider reconciliation completed cleanly." : "Provider reconciliation completed with breaks or failures.");
  }

  async function confirmReleaseReserve(reason: string) {
    if (!releasingSellerId) return;
    const result = await releaseReserveMutation.run({ sellerUserId: releasingSellerId, reason });
    if (result === null && releaseReserveMutation.errorMessage) return;
    showToast("Seller reserve hold released.");
    setReleasingSellerId(null);
    sellerReserves.reload();
  }

  const reserveColumns: readonly DataTableColumn<SellerReserveHold>[] = [
    { key: "sellerUserId", header: "Seller ID", isMono: true, render: (row) => row.sellerUserId },
    { key: "reserveBps", header: "Reserve", align: "end", isMono: true, render: (row) => `${(row.reserveBps / 100).toFixed(2)}%` },
    { key: "holdDays", header: "Hold window", align: "end", render: (row) => `${row.holdDays}d` },
    { key: "reason", header: "Reason", render: (row) => row.reason },
    { key: "actions", header: "Action", render: (row) => <Button size="small" variant="secondary" onClick={() => setReleasingSellerId(row.sellerUserId)}>Release hold</Button> },
  ];

  async function confirmPayoutAction(reason: string) {
    if (!pendingPayoutAction) return;
    if (!(await payoutActionMutation.run({ action: pendingPayoutAction, reason }))) return;
    showToast(pendingPayoutAction.type === "retry" ? "Payout onboarding job queued for retry." : "Verification prompt sent to account holder.");
    setPendingPayoutAction(null);
    stuckAccounts.reload();
  }

  const stuckColumns: readonly DataTableColumn<StuckPayoutAccount>[] = [
    { key: "userId", header: "User ID", isMono: true, render: (row) => row.userId },
    { key: "status", header: "Account status", render: (row) => humanizeConstantName(row.account.status) },
    { key: "verification", header: "Verification", render: (row) => (row.account.verificationStatus ? humanizeConstantName(row.account.verificationStatus) : "—") },
    { key: "jobs", header: "Open jobs", render: (row) => row.jobs.map((job) => `${job.jobType ?? job.id} (${job.status})`).join(", ") || "None" },
    { key: "actions", header: "Actions", render: (row) => {
      const firstJob = row.jobs[0];
      return (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {firstJob ? <Button size="small" variant="secondary" onClick={() => setPendingPayoutAction({ type: "retry", jobId: firstJob.id })}>Retry job</Button> : null}
          <Button size="small" variant="ghost" onClick={() => setPendingPayoutAction({ type: "prompt", userId: row.userId })}>Prompt verification</Button>
        </div>
      );
    } },
  ];

  const columns: readonly DataTableColumn<FinanceIssue>[] = [
    { key: "queue", header: "Queue", render: (row) => humanizeConstantName(row.queue) },
    { key: "severity", header: "Severity", render: (row) => <StatusBadge status={row.severity} /> },
    { key: "reference", header: "Reference", render: (row) => row.reference, isMono: true },
    { key: "summary", header: "Issue", render: (row) => row.summary },
    { key: "amount", header: "Amount", render: (row) => (row.amount ? formatMoneyForDisplay(row.amount) : <span className={styles.muted}>—</span>) },
    { key: "detected", header: "Age", render: (row) => (row.detectedAt ? formatRelativeTimeFromNow(row.detectedAt) : <span className={styles.muted}>—</span>) },
    { key: "action", header: "Inspect", render: (row) => {
      const allowed = row.actionHref.startsWith("/finance/")
        || (row.actionHref.startsWith("/commerce/orders/") && can("orders:read"))
        || (row.actionHref.startsWith("/commerce/disputes/") && can("disputes:resolve"))
        || (row.actionHref.startsWith("/commerce/payouts/") && can("payouts:approve"))
        || (row.actionHref.startsWith("/commerce/ledger") && can("ledger:read"));
      return allowed ? <ButtonLink href={row.actionHref} size="small" variant="ghost">Open</ButtonLink> : <span className={styles.muted}>—</span>;
    } },
  ];

  return (
    <>
      <PageHeader
        area="Finance"
        title="Financial issues queue"
        description="SLA-breaching disputes, stuck escrows, aged payouts, failed payment intents, and seller debt accounts."
        actions={
          <>
            {canManagePayoutAccounts ? (
              <Button variant="secondary" onClick={() => setReconcileOpen(true)}>
                Reconcile provider balances
              </Button>
            ) : null}
            <Button variant="secondary" iconName="export24" onClick={() => setExportOpen(true)}>
              Export CSV
            </Button>
          </>
        }
      />
      {reconcileReport ? (
        <NoticeBanner
          tone={reconcileReport.balanceBreaks.length === 0 && reconcileReport.failures === 0 ? "success" : "caution"}
          title="Provider balance reconciliation report"
        >
          Checked {reconcileReport.accountsChecked} accounts · verified {reconcileReport.pendingIntentsVerified} pending intents · confirmed {reconcileReport.transfersConfirmed} transfers · settled {reconcileReport.directChargesSettled} charges · {reconcileReport.balanceBreaks.length} balance break(s) · {reconcileReport.failures} failure(s).
        </NoticeBanner>
      ) : null}
      <Toolbar>
        <SelectField label="Queue" isLabelHidden options={queueOptions} value={queue} onChange={(event) => setQueue(event.target.value)} />
        {data ? (
          <div className={styles.quickLinks}>
            {Object.entries(data.queueCounts).map(([key, count]) => (
              <Button key={key} size="small" variant={queue === key ? "primary" : "ghost"} onClick={() => setQueue(queue === key ? "" : key)}>
                {humanizeConstantName(key)}: {count}
              </Button>
            ))}
          </div>
        ) : null}
      </Toolbar>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Financial issues"
        columns={columns}
        rows={data?.data ?? []}
        readRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No open financial issues match this queue."
      />
      {canManagePayoutAccounts ? (
        <>
          <SectionHeading>Stuck payout accounts</SectionHeading>
          <DataTable
            caption="Stuck payout accounts"
            columns={stuckColumns}
            rows={stuckAccounts.data?.data ?? []}
            readRowKey={(row) => row.userId}
            isLoading={stuckAccounts.isLoading}
            emptyMessage="No stuck payout accounts."
          />
        </>
      ) : null}
      {canManageSellerReserves ? (
        <>
          <SectionHeading>Active seller reserve holds</SectionHeading>
          <DataTable
            caption="Active seller reserve holds"
            columns={reserveColumns}
            rows={sellerReserves.data?.data ?? []}
            readRowKey={(row) => row.sellerUserId}
            isLoading={sellerReserves.isLoading}
            emptyMessage="No active seller reserve holds."
          />
        </>
      ) : null}
      <FinanceExportDialog isOpen={exportOpen} reportType="issues" range="7d" onClose={() => setExportOpen(false)} />
      <ConfirmActionDialog
        isOpen={releasingSellerId !== null}
        title="Release seller reserve hold"
        consequences={["Lifts the rolling payout reserve for this seller immediately.", "Requires step-up verification and is recorded in the audit log."]}
        confirmLabel="Release hold"
        requiresReason
        requiresStepUp
        isBusy={releaseReserveMutation.isRunning}
        errorMessage={releaseReserveMutation.errorMessage}
        onConfirm={confirmReleaseReserve}
        onClose={() => { releaseReserveMutation.clearError(); setReleasingSellerId(null); }}
      />
      <ConfirmActionDialog
        isOpen={pendingPayoutAction !== null}
        title={pendingPayoutAction?.type === "retry" ? "Retry payout onboarding job" : "Send payout verification prompt"}
        consequences={["Notifies the payment provider or account owner immediately.", "Requires step-up verification and is recorded in the audit log."]}
        confirmLabel={pendingPayoutAction?.type === "retry" ? "Retry job" : "Send prompt"}
        requiresReason
        requiresStepUp
        isBusy={payoutActionMutation.isRunning}
        errorMessage={payoutActionMutation.errorMessage}
        onConfirm={confirmPayoutAction}
        onClose={() => { payoutActionMutation.clearError(); setPendingPayoutAction(null); }}
      />
      <ConfirmActionDialog
        isOpen={reconcileOpen}
        title="Run provider balance reconciliation"
        description="Verifies pending payment intents, payout transfers, direct charges, and provider mirror balances against the ledger."
        confirmLabel="Run reconciliation"
        requiresReason
        requiresStepUp
        isBusy={reconcileMutation.isRunning}
        errorMessage={reconcileMutation.errorMessage}
        onConfirm={confirmReconcile}
        onClose={() => { reconcileMutation.clearError(); setReconcileOpen(false); }}
      />
    </>
  );
}
