import type { Money } from "@/types/money.type";

export type ReportBreakdown = "campaign" | "ad_set" | "ad" | "placement" | "day" | "country" | "state" | "age" | "gender";
export type ClickAttributionWindow = 1 | 7 | 28;
export type ViewAttributionWindow = 0 | 1;

export interface ReportMetrics {
  readonly impressions: number;
  readonly reach: number;
  readonly frequency: number;
  readonly clicks: number;
  readonly ctr: number;
  readonly cpc: Money | null;
  readonly cpm: Money | null;
  readonly spend: Money;
  readonly conversions: number;
  readonly conversionValue: Money;
  readonly roas: number | null;
  readonly videoViews: number;
  readonly averageWatchPercent: number | null;
  readonly followersGained: number;
}

export type MetricKey = keyof ReportMetrics;

export interface ReportQuery {
  readonly from: string;
  readonly to: string;
  readonly compareFrom: string | null;
  readonly compareTo: string | null;
  readonly breakdown: ReportBreakdown;
  readonly campaignIds: readonly string[];
  readonly clickWindowDays: ClickAttributionWindow;
  readonly viewWindowDays: ViewAttributionWindow;
}

export interface ReportRow {
  readonly key: string;
  readonly label: string;
  readonly metrics: ReportMetrics;
  readonly comparison: ReportMetrics | null;
}

export interface ReportSeriesPoint {
  readonly date: string;
  readonly metrics: ReportMetrics;
}

export interface ReportResponse {
  readonly currency: string;
  readonly query: ReportQuery;
  readonly totals: ReportMetrics;
  readonly comparisonTotals: ReportMetrics | null;
  readonly rows: readonly ReportRow[];
  readonly series: readonly ReportSeriesPoint[];
  readonly comparisonSeries: readonly ReportSeriesPoint[];
  readonly generatedAt: string;
}

export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface ScheduledReport {
  readonly id: string;
  readonly name: string;
  readonly recipients: readonly string[];
  readonly frequency: ReportFrequency;
  readonly breakdown: ReportBreakdown;
  readonly metrics: readonly MetricKey[];
  readonly nextSendAt: string;
  readonly createdAt: string;
}

export interface ScheduledReportInput {
  readonly name: string;
  readonly recipients: readonly string[];
  readonly frequency: ReportFrequency;
  readonly breakdown: ReportBreakdown;
  readonly metrics: readonly MetricKey[];
}
