import type { ReportCellValue, ReportColumn, ReportResult } from "@/types/report.type";
import { convertMinorUnitsToMajorInputText, isSupportedCurrencyCode } from "@/utils/money.util";
import type { SpreadsheetCellValue, SpreadsheetSheet } from "@/utils/xlsxWorkbook.util";

function convertReportCellToSpreadsheetValue(value: ReportCellValue | undefined, column: ReportColumn): SpreadsheetCellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return isSupportedCurrencyCode(value.currency) ? Number(convertMinorUnitsToMajorInputText(value.amountMinor, value.currency)) : value.amountMinor;
  if (column.kind === "percent" && typeof value === "number") return Math.round(value) / 100;
  return value;
}

export function buildReportColumnHeaderForExport(column: ReportColumn, currency: string | null): string {
  if (column.kind === "money" && currency) return `${column.label} (${currency})`;
  if (column.kind === "percent") return `${column.label} (%)`;
  return column.label;
}

export function convertReportResultToSpreadsheetSheet(report: ReportResult, currency: string | null): SpreadsheetSheet {
  const rows = [...report.rows, ...(report.totals ? [report.totals] : [])].map((row) => report.columns.map((column) => convertReportCellToSpreadsheetValue(row[column.key], column)));
  return { name: report.title, headers: report.columns.map((column) => buildReportColumnHeaderForExport(column, currency)), rows, boldLastRow: report.totals !== null };
}

export function buildReportFileBaseName(report: ReportResult, usesDateRange: boolean): string {
  return `${report.reportKind}_${usesDateRange ? `${report.from}_${report.to}` : report.generatedAt.slice(0, 10)}`;
}

export function readReportCellSortValue(value: ReportCellValue | undefined): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value.amountMinor;
  return value;
}
