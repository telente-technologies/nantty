"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { Card } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchFinanceReports } from "@/services/financeApi.service";
import type { FinanceExportRecord, FinanceReportKey, FinanceReportSummary } from "@/types/finance.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./finance.module.css";
import { FinanceExportDialog } from "./financeExportDialog";

export function FinanceReportsWorkspace() {
  const [selectedReport, setSelectedReport] = useState<FinanceReportKey | null>(null);
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery((signal) => fetchFinanceReports(signal), "finance-reports");

  const catalogColumns: readonly DataTableColumn<FinanceReportSummary>[] = [
    { key: "title", header: "Report", render: (row) => <strong>{row.title}</strong> },
    { key: "description", header: "Scope", render: (row) => row.description },
    { key: "lastExport", header: "Last exported", render: (row) => (row.lastExport ? formatDateTime(row.lastExport) : <span className={styles.muted}>Never</span>) },
    { key: "action", header: "Export", render: (row) => <Button size="small" variant="secondary" iconName="export24" onClick={() => setSelectedReport(row.key)}>Export CSV</Button> },
  ];

  const auditColumns: readonly DataTableColumn<FinanceExportRecord>[] = [
    { key: "reportKey", header: "Report", render: (row) => humanizeConstantName(row.reportKey) },
    { key: "actor", header: "Exported by", render: (row) => row.actorName || row.actorId },
    { key: "reason", header: "Reason", render: (row) => row.reason },
    { key: "occurredAt", header: "Timestamp", render: (row) => formatDateTime(row.occurredAt) },
  ];

  return (
    <>
      <PageHeader
        area="Finance"
        title="Finance reports"
        description="Audited CSV exports across platform GMV, escrow holds, aspect revenue, and financial issue queues."
      />
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !data ? <LoadingBlock lines={5} /> : null}
      {data ? (
        <div className={styles.layout}>
          <DataTable
            caption="Available finance reports"
            columns={catalogColumns}
            rows={data.reports}
            readRowKey={(row) => row.key}
            emptyMessage="No reports configured."
          />
          <Card title="Recent finance exports" isFlush>
            <DataTable
              caption="Recent audited finance exports"
              columns={auditColumns}
              rows={data.recent}
              readRowKey={(row) => row.id}
              emptyMessage="No finance reports exported yet."
            />
          </Card>
        </div>
      ) : null}
      <FinanceExportDialog
        isOpen={selectedReport !== null}
        reportType={selectedReport ?? "overview"}
        range="7d"
        onClose={() => setSelectedReport(null)}
        onExported={reload}
      />
    </>
  );
}
