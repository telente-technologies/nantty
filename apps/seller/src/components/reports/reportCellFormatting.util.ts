import type { Money } from "@/types/money.type";
import type { ReportCellValue, ReportColumn } from "@/types/report.type";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent, formatMoneyForDisplay, isSupportedCurrencyCode } from "@/utils/money.util";

export function isMoneyCellValue(value: ReportCellValue): value is Money {
  return typeof value === "object" && value !== null && "amountMinor" in value && isSupportedCurrencyCode(value.currency);
}

export function formatReportCellForDisplay(value: ReportCellValue | undefined, column: ReportColumn, locale: string, timeZone: string): string {
  if (value === null || value === undefined) return "—";
  if (isMoneyCellValue(value)) return formatMoneyForDisplay(value, locale);
  if (typeof value === "number") {
    if (column.kind === "percent") return formatBasisPointsAsPercent(value);
    return new Intl.NumberFormat(locale).format(value);
  }
  if (column.kind === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateForDisplay(`${value}T12:00:00.000Z`, locale, "UTC");
    if (!Number.isNaN(Date.parse(value))) return formatDateTimeForDisplay(value, locale, timeZone);
  }
  return value;
}
