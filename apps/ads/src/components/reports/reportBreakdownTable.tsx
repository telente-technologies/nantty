"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { MetricDeltaText } from "@/components/reports/metricDeltaText";
import { describeMetricChangeAgainstComparison } from "@/components/reports/reportChartData.util";
import { breakdownOptions, metricDefinitions } from "@/constants/reportOptions.constant";
import type { MetricKey, ReportBreakdown, ReportResponse, ReportRow } from "@/types/report.type";
import { formatDateWithYear } from "@/utils/dateRange.util";
import { formatMetricValueForDisplay, readMetricNumericValue } from "@/utils/numberFormatting.util";

import styles from "./reportsPage.module.css";

interface ReportBreakdownTableProps {
  readonly report: ReportResponse;
  readonly breakdown: ReportBreakdown;
  readonly visibleColumns: readonly MetricKey[];
  readonly onVisibleColumnsChange: (columns: MetricKey[]) => void;
  readonly toolbar: React.ReactNode;
}

function formatRowLabel(row: ReportRow, breakdown: ReportBreakdown): string {
  return breakdown === "day" ? formatDateWithYear(row.key) : row.label;
}

export function ReportBreakdownTable({ report, breakdown, visibleColumns, onVisibleColumnsChange, toolbar }: ReportBreakdownTableProps) {
  const hasComparison = report.comparisonTotals !== null;
  const breakdownLabel = breakdownOptions.find((option) => option.breakdown === breakdown)?.label ?? "Item";
  const columns: DataTableColumn<ReportRow>[] = [
    {
      key: "label",
      header: breakdownLabel,
      isAlwaysVisible: true,
      sortValue: (row) => row.key,
      render: (row) => <span className={styles.rowLabel}>{formatRowLabel(row, breakdown)}</span>,
      footer: "Total",
    },
    ...metricDefinitions.map<DataTableColumn<ReportRow>>((definition) => ({
      key: definition.key,
      header: definition.shortLabel,
      align: "end",
      sortValue: (row) => readMetricNumericValue(row.metrics, definition.key),
      render: (row) => (
        <span className={styles.metricCell}>
          {formatMetricValueForDisplay(row.metrics, definition.key)}
          {hasComparison ? <MetricDeltaText delta={describeMetricChangeAgainstComparison(definition.key, row.metrics, row.comparison)} /> : null}
        </span>
      ),
      footer: (
        <span className={styles.metricCell}>
          {formatMetricValueForDisplay(report.totals, definition.key)}
          {hasComparison ? <MetricDeltaText delta={describeMetricChangeAgainstComparison(definition.key, report.totals, report.comparisonTotals)} /> : null}
        </span>
      ),
    })),
  ];
  return (
    <DataTable
      caption={`Results broken down by ${breakdownLabel.toLowerCase()}`}
      columns={columns}
      rows={report.rows}
      readRowId={(row) => row.key}
      showColumnPicker
      visibleColumnKeys={visibleColumns}
      onVisibleColumnKeysChange={(keys) => onVisibleColumnsChange(metricDefinitions.map((definition) => definition.key).filter((key) => keys.includes(key)))}
      toolbar={toolbar}
      hasFooter
      emptyState="No delivery in this date range. Try a longer range or remove the campaign filter."
    />
  );
}
