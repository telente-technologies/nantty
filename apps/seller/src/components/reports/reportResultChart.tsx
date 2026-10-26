"use client";

import { HorizontalBarList } from "@/components/charts/horizontalBarList";
import { LineChart } from "@/components/charts/lineChart";
import type { ReportCatalogEntry } from "@/constants/reportCatalog.constant";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { ReportResult } from "@/types/report.type";
import { formatShortDateLabel } from "@/utils/chartScale.util";

import { formatReportCellForDisplay, isMoneyCellValue } from "./reportCellFormatting.util";

export function ReportResultChart({ catalogEntry, report, timeZone }: { readonly catalogEntry: ReportCatalogEntry; readonly report: ReportResult; readonly timeZone: string }) {
  const { formatMoney, formatMoneyCompact, currency, locale } = useMoneyFormatter();
  if (catalogEntry.chart === "daily-revenue" && currency) {
    return (
      <LineChart
        title={`Revenue per day from ${report.from} to ${report.to}`}
        description="Daily revenue from orders placed in the Nantty app."
        series={[{ key: "revenue", label: "Revenue", colorVariable: "--chart-1" }]}
        points={report.rows.map((row) => ({ label: String(row.date), shortLabel: formatShortDateLabel(String(row.date), locale), values: { revenue: isMoneyCellValue(row.revenue ?? null) ? (row.revenue as { amountMinor: number }).amountMinor : 0 } }))}
        formatValue={(value) => formatMoney({ amountMinor: value, currency })}
        formatAxisValue={(value) => formatMoneyCompact({ amountMinor: value, currency })}
      />
    );
  }
  if (catalogEntry.chart !== "ranked") return null;
  const labelColumn = report.columns.find((column) => column.kind === "text");
  const valueColumn = report.columns.find((column) => column.kind === "money") ?? report.columns.find((column) => column.kind === "number" && column.key !== "rank");
  if (!labelColumn || !valueColumn) return null;
  const items = report.rows
    .map((row, index) => {
      const cell = row[valueColumn.key] ?? null;
      const numericValue = isMoneyCellValue(cell) ? cell.amountMinor : typeof cell === "number" ? cell : 0;
      return { key: String(index), label: String(row[labelColumn.key] ?? ""), value: numericValue, displayValue: formatReportCellForDisplay(cell, valueColumn, locale, timeZone) };
    })
    .sort((first, second) => second.value - first.value)
    .slice(0, 8);
  return <HorizontalBarList title={`${catalogEntry.title}: top ${items.length} by ${valueColumn.label.toLowerCase()}`} items={items} />;
}
