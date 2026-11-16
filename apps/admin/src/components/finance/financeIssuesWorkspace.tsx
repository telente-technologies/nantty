"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchFinanceIssues } from "@/services/financeApi.service";
import type { FinanceIssue } from "@/types/finance.type";
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
  const [queue, setQueue] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery(
    (signal) => fetchFinanceIssues({ queue: queue || undefined, limit: 100 }, signal),
    queue,
  );

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
          <Button variant="secondary" iconName="export24" onClick={() => setExportOpen(true)}>
            Export CSV
          </Button>
        }
      />
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
      <FinanceExportDialog isOpen={exportOpen} reportType="issues" range="7d" onClose={() => setExportOpen(false)} />
    </>
  );
}
