import type { LineChartPoint } from "@/components/charts/lineChart";
import { findMetricDefinition } from "@/constants/reportOptions.constant";
import type { MetricKey, ReportMetrics, ReportSeriesPoint } from "@/types/report.type";
import { formatShortDate } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { calculatePercentChange, formatCompactCount, formatMetricValueForDisplay, formatPercentFromRatio, readMetricNumericValue } from "@/utils/numberFormatting.util";

export function convertSeriesToLineChartPoints(series: readonly ReportSeriesPoint[], metricKey: MetricKey): LineChartPoint[] {
  return series.map((point) => ({ label: formatShortDate(point.date), value: readMetricNumericValue(point.metrics, metricKey) ?? 0, formattedValue: formatMetricValueForDisplay(point.metrics, metricKey) }));
}

export function buildAxisValueFormatterForMetric(metricKey: MetricKey, currency: string): (value: number) => string {
  const format = findMetricDefinition(metricKey).format;
  if (format === "money") return (value) => formatMoneyForDisplay({ amountMinor: value, currency }, { compact: true });
  if (format === "percent") return (value) => formatPercentFromRatio(value, value < 0.1 ? 1 : 0);
  if (format === "ratio") return (value) => `${value.toFixed(1)}×`;
  if (format === "decimal") return (value) => value.toFixed(1);
  return (value) => formatCompactCount(value);
}

export type DeltaTone = "better" | "worse" | "neutral";

export interface MetricDelta {
  readonly change: number | null;
  readonly tone: DeltaTone;
  readonly label: string;
}

export function describeMetricChangeAgainstComparison(metricKey: MetricKey, current: ReportMetrics, previous: ReportMetrics | null): MetricDelta | null {
  if (!previous) return null;
  const change = calculatePercentChange(readMetricNumericValue(current, metricKey), readMetricNumericValue(previous, metricKey));
  if (change === null) return { change: null, tone: "neutral", label: "No earlier data" };
  const isFlat = Math.abs(change) < 0.005;
  const improved = findMetricDefinition(metricKey).higherIsBetter ? change > 0 : change < 0;
  const sign = change > 0 ? "+" : "";
  return { change, tone: isFlat ? "neutral" : improved ? "better" : "worse", label: `${sign}${formatPercentFromRatio(change, 1)}` };
}
