import type { DataTableColumn } from "@/components/ui/dataTable";
import type { ReportCellValue, ReportColumn } from "@/types/report.type";

import { formatReportCellForDisplay } from "./reportCellFormatting.util";

type ReportRow = { readonly cells: Record<string, ReportCellValue>; readonly isTotals: boolean };

export function reportTableColumnsFor(reportColumns: readonly ReportColumn[], locale: string, timeZone: string, totalsClassName: string): DataTableColumn<ReportRow>[] {
  return reportColumns.map((column, columnIndex) => ({
    key: column.key,
    header: column.label,
    align: column.kind === "text" || column.kind === "date" ? "start" : "end",
    hideBelowTablet: reportColumns.length > 6 && columnIndex > 0 && column.kind === "text",
    render: (row) => <span className={row.isTotals ? totalsClassName : undefined}>{row.isTotals && row.cells[column.key] === null ? "" : formatReportCellForDisplay(row.cells[column.key], column, locale, timeZone)}</span>,
  }));
}
