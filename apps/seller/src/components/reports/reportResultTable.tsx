"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState, type TableSortValueReader } from "@/hooks/useClientTableState.hook";
import type { ReportResult } from "@/types/report.type";

import { readReportCellSortValue } from "./reportExport.util";
import { reportTableColumnsFor, type ReportTableRow } from "./reportTableColumns";
import styles from "./reports.module.css";

interface ReportResultTableProps {
  readonly caption: string;
  readonly report: ReportResult | null;
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
  readonly locale: string;
  readonly timeZone: string;
}

export function ReportResultTable({ caption, report, isLoading, errorMessage, onRetry, locale, timeZone }: ReportResultTableProps) {
  const dataRows = useMemo<ReportTableRow[] | null>(() => (report ? report.rows.map((cells, index) => ({ cells, rowKey: String(index), isTotals: false })) : null), [report]);
  const sortValueReaders = useMemo(() => Object.fromEntries((report?.columns ?? []).map((column) => [column.key, ((row: ReportTableRow) => readReportCellSortValue(row.cells[column.key])) as TableSortValueReader<ReportTableRow>])), [report]);
  const tableState = useClientTableState(dataRows, sortValueReaders, { pageSize: 25 });
  const columns = useMemo(() => (report ? reportTableColumnsFor(report.columns, locale, timeZone, styles.totalsRow ?? "") : []), [report, locale, timeZone]);
  const isLastPage = tableState.pageIndex >= tableState.pageCount - 1;
  const visibleRows = tableState.visibleRows && report?.totals && isLastPage && tableState.totalCount > 0 ? [...tableState.visibleRows, { cells: report.totals, rowKey: "totals", isTotals: true }] : tableState.visibleRows;

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={visibleRows}
      readRowKey={(row) => row.rowKey}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRetry={onRetry}
      sortState={tableState.sortState}
      onSortChange={tableState.setSortState}
      emptyState={<EmptyState iconName="textIndent24" title="No data for these filters" description="Try a wider date range or another location." />}
      footer={tableState.pageCount > 1 ? <TablePagination pageIndex={tableState.pageIndex} pageCount={tableState.pageCount} totalCount={tableState.totalCount} pageSize={tableState.pageSize} onPageChange={tableState.setPageIndex} itemLabel="rows" /> : null}
    />
  );
}
