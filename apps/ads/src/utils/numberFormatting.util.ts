import { findMetricDefinition } from "@/constants/reportOptions.constant";
import { defaultDisplayLocale } from "@/constants/locale.constant";
import type { Money, NumberRange } from "@/types/money.type";
import type { MetricKey, ReportMetrics } from "@/types/report.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

export function formatWholeCount(value: number): string {
  return new Intl.NumberFormat(defaultDisplayLocale, { maximumFractionDigits: 0 }).format(value);
}

export function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(defaultDisplayLocale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercentFromRatio(ratio: number | null, fractionDigits = 2): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(defaultDisplayLocale, { style: "percent", minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(ratio);
}

export function formatRangeOfPeople(range: NumberRange | null): string {
  if (!range) return "—";
  return `${formatCompactCount(range.lower)} – ${formatCompactCount(range.upper)}`;
}

function isMoneyValue(value: unknown): value is Money {
  return typeof value === "object" && value !== null && "amountMinor" in value && "currency" in value;
}

export function formatMetricValueForDisplay(metrics: ReportMetrics, key: MetricKey): string {
  const value = metrics[key];
  const definition = findMetricDefinition(key);
  if (value === null) return "—";
  if (isMoneyValue(value)) return formatMoneyForDisplay(value);
  if (definition.format === "percent") return formatPercentFromRatio(value, key === "averageWatchPercent" ? 0 : 2);
  if (definition.format === "ratio") return `${value.toFixed(2)}×`;
  if (definition.format === "decimal") return value.toFixed(2);
  return formatWholeCount(value);
}

export function readMetricNumericValue(metrics: ReportMetrics, key: MetricKey): number | null {
  const value = metrics[key];
  if (value === null) return null;
  return isMoneyValue(value) ? value.amountMinor : value;
}

export function calculatePercentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
