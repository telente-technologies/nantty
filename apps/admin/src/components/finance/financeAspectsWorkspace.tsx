"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchMoneyByAspect } from "@/services/financeApi.service";
import type { FinanceAspect, FinanceAspectRow, FinanceRange } from "@/types/finance.type";
import { formatMoneyForDisplay, formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";

import { FinanceExportDialog } from "./financeExportDialog";

const aspectTabs = [
  { key: "all", label: "All" },
  { key: "orders", label: "Orders" },
  { key: "coins", label: "Coins" },
  { key: "ads", label: "Ads" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "payouts", label: "Payouts" },
  { key: "ledger", label: "Ledger" },
] as const;

const rangeOptions = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export function FinanceAspectsWorkspace() {
  const [aspect, setAspect] = useState<FinanceAspect>("all");
  const [range, setRange] = useState<FinanceRange>("7d");
  const [currency, setCurrency] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const { data, errorMessage, error, isLoading, reload } = useAdminQuery(
    (signal) => fetchMoneyByAspect(aspect, range, currency || undefined, signal),
    `${aspect}:${range}:${currency}`,
  );

  const columns: readonly DataTableColumn<FinanceAspectRow>[] = [
    { key: "group", header: "Stream", render: (row) => humanizeConstantName(row.group || "general") },
    { key: "status", header: "State / owner", render: (row) => <StatusBadge status={row.status || "none"} /> },
    { key: "currency", header: "Currency", render: (row) => row.currency, isMono: true },
    { key: "count", header: "Records", render: (row) => formatWholeNumber(row.count) },
    { key: "amount", header: "Volume / balance", render: (row) => formatMoneyForDisplay({ amountMinor: row.amountMinor, currency: row.currency }) },
  ];

  return (
    <>
      <PageHeader
        area="Finance"
        title="Revenue & flows by aspect"
        description="Analyze orders, coins, ads top-ups, subscriptions, withdrawals, and ledger accounts."
        actions={
          <Button variant="secondary" iconName="export24" onClick={() => setExportOpen(true)}>
            Export CSV
          </Button>
        }
      />
      <Toolbar>
        <SegmentedTabs label="Finance aspect" items={aspectTabs} activeKey={aspect} onChange={setAspect} />
        <SelectField label="Range" isLabelHidden options={rangeOptions} value={range} onChange={(event) => setRange(event.target.value as FinanceRange)} />
        <SelectField
          label="Currency"
          isLabelHidden
          options={[{ value: "", label: "All currencies" }, { value: "NGN", label: "NGN" }, { value: "USD", label: "USD" }]}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        />
      </Toolbar>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Money breakdown by aspect"
        columns={columns}
        rows={data?.breakdown ?? []}
        readRowKey={(row) => `${row.group}:${row.status}:${row.currency}`}
        isLoading={isLoading}
        emptyMessage="No transactions recorded for this aspect and range."
      />
      <FinanceExportDialog isOpen={exportOpen} reportType="money_by_aspect" range={range} currency={currency} onClose={() => setExportOpen(false)} />
    </>
  );
}
