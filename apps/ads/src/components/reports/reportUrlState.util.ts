import { breakdownOptions, defaultReportColumns, metricDefinitions } from "@/constants/reportOptions.constant";
import type { ClickAttributionWindow, MetricKey, ReportBreakdown, ReportQuery, ViewAttributionWindow } from "@/types/report.type";
import { buildDateRangeFromPreset, buildPreviousPeriodForComparison, isValidIsoDate, type DateRangePreset } from "@/utils/dateRange.util";

export interface ReportViewState {
  readonly preset: DateRangePreset;
  readonly from: string;
  readonly to: string;
  readonly isComparing: boolean;
  readonly breakdown: ReportBreakdown;
  readonly campaignIds: readonly string[];
  readonly clickWindowDays: ClickAttributionWindow;
  readonly viewWindowDays: ViewAttributionWindow;
  readonly chartMetric: MetricKey;
  readonly columns: readonly MetricKey[];
}

const presets: readonly DateRangePreset[] = ["today", "yesterday", "last_7_days", "last_14_days", "last_30_days", "this_month", "last_month", "custom"];
const metricKeys = metricDefinitions.map((definition) => definition.key);

function readMetricKeyList(rawValue: string | null): MetricKey[] {
  return (rawValue ?? "").split(",").filter((key): key is MetricKey => metricKeys.includes(key as MetricKey));
}

export function readReportViewStateFromSearchParams(searchParams: URLSearchParams): ReportViewState {
  const requestedPreset = searchParams.get("preset") as DateRangePreset | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const hasCustomDates = isValidIsoDate(from) && isValidIsoDate(to) && from <= to;
  const preset: DateRangePreset = requestedPreset && presets.includes(requestedPreset) ? requestedPreset : hasCustomDates ? "custom" : "last_14_days";
  const range = preset === "custom" && hasCustomDates ? { from, to } : buildDateRangeFromPreset(preset === "custom" ? "last_14_days" : preset);
  const breakdown = searchParams.get("breakdown") as ReportBreakdown | null;
  const click = Number(searchParams.get("click"));
  const columns = readMetricKeyList(searchParams.get("columns"));
  const chartMetric = searchParams.get("metric") as MetricKey | null;
  return {
    preset,
    from: range.from,
    to: range.to,
    isComparing: searchParams.get("compare") !== "0",
    breakdown: breakdown && breakdownOptions.some((option) => option.breakdown === breakdown) ? breakdown : "campaign",
    campaignIds: (searchParams.get("campaigns") ?? "").split(",").filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)),
    clickWindowDays: click === 1 || click === 28 ? click : 7,
    viewWindowDays: searchParams.get("view") === "0" ? 0 : 1,
    chartMetric: chartMetric && metricKeys.includes(chartMetric) ? chartMetric : "spend",
    columns: columns.length > 0 ? columns : defaultReportColumns,
  };
}

export function writeReportViewStateToSearchParams(state: ReportViewState): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("preset", state.preset);
  if (state.preset === "custom") {
    searchParams.set("from", state.from);
    searchParams.set("to", state.to);
  }
  if (!state.isComparing) searchParams.set("compare", "0");
  searchParams.set("breakdown", state.breakdown);
  if (state.campaignIds.length > 0) searchParams.set("campaigns", state.campaignIds.join(","));
  if (state.clickWindowDays !== 7) searchParams.set("click", String(state.clickWindowDays));
  if (state.viewWindowDays !== 1) searchParams.set("view", String(state.viewWindowDays));
  if (state.chartMetric !== "spend") searchParams.set("metric", state.chartMetric);
  if (state.columns.join(",") !== defaultReportColumns.join(",")) searchParams.set("columns", state.columns.join(","));
  return searchParams;
}

export function convertReportViewStateToQuery(state: ReportViewState): ReportQuery {
  const previous = buildPreviousPeriodForComparison({ from: state.from, to: state.to });
  return {
    from: state.from,
    to: state.to,
    compareFrom: state.isComparing ? previous.from : null,
    compareTo: state.isComparing ? previous.to : null,
    breakdown: state.breakdown,
    campaignIds: state.campaignIds,
    clickWindowDays: state.clickWindowDays,
    viewWindowDays: state.viewWindowDays,
  };
}
