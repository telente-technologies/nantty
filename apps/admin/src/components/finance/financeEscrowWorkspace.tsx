"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchEscrowHeld, fetchStuckEscrows } from "@/services/financeApi.service";
import type { FinanceEscrowRecord } from "@/types/finance.type";
import { formatDateTime, formatMoneyForDisplay } from "@/utils/formatting.util";

import { FinanceExportDialog } from "./financeExportDialog";

const viewTabs = [
  { key: "held", label: "Held & disputed" },
  { key: "stuck", label: "Stuck (no auto-release)" },
] as const;

const currencyOptions = [
  { value: "", label: "All currencies" },
  { value: "NGN", label: "NGN" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
];

export function FinanceEscrowWorkspace() {
  const router = useRouter();
  const { canAny } = useAdminPermissions();
  const canOpenOrder = canAny("orders:read", "disputes:resolve", "refunds:issue", "support:tickets");
  const [view, setView] = useState<"held" | "stuck">("held");
  const [currency, setCurrency] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [exportOpen, setExportOpen] = useState(false);

  const { data, errorMessage, error, isLoading, reload } = useAdminQuery(
    (signal) =>
      view === "stuck"
        ? fetchStuckEscrows({ currency: currency || undefined, cursor }, signal)
        : fetchEscrowHeld({ currency: currency || undefined, cursor }, signal),
    `${view}:${currency}:${cursor ?? ""}`,
  );

  const columns: readonly DataTableColumn<FinanceEscrowRecord>[] = [
    { key: "orderId", header: "Order", render: (row) => row.orderId, isMono: true },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "amount", header: "Amount", render: (row) => formatMoneyForDisplay(row.amount) },
    { key: "autoReleaseAt", header: "Auto-release", render: (row) => (row.autoReleaseAt ? formatDateTime(row.autoReleaseAt) : row.stuck ? <StatusBadge label="Missing schedule" tone="caution" /> : "—") },
    { key: "deliveredAt", header: "Delivered", render: (row) => (row.deliveredAt ? formatDateTime(row.deliveredAt) : "Not delivered") },
  ];

  return (
    <>
      <PageHeader
        area="Finance"
        title="Escrow health"
        description="Inspect held, disputed, partially refunded, and stuck escrow balances."
        actions={
          <>
            <SegmentedTabs label="Escrow view" items={viewTabs} activeKey={view} onChange={(next) => { setView(next); setCursor(undefined); }} />
            <Button variant="secondary" iconName="export24" onClick={() => setExportOpen(true)}>
              Export CSV
            </Button>
          </>
        }
      />
      <Toolbar>
        <SelectField label="Currency" isLabelHidden options={currencyOptions} value={currency} onChange={(event) => { setCurrency(event.target.value); setCursor(undefined); }} />
      </Toolbar>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Escrow balances"
        columns={columns}
        rows={data?.items ?? []}
        readRowKey={(row) => row.id}
        isLoading={isLoading}
        onRowOpen={canOpenOrder ? (row) => router.push(`/commerce/orders/${encodeURIComponent(row.orderId)}`) : undefined}
        emptyMessage={view === "stuck" ? "No stuck escrows detected." : "No open escrows match this currency."}
      />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      <FinanceExportDialog
        isOpen={exportOpen}
        reportType={view === "stuck" ? "stuck_escrows" : "escrow_held"}
        range="7d"
        currency={currency}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}
