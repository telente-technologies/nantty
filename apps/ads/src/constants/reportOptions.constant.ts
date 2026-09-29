import type { MetricKey, ReportBreakdown } from "@/types/report.type";

export type MetricFormat = "count" | "money" | "percent" | "ratio" | "decimal";

export interface MetricDefinition {
  readonly key: MetricKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly format: MetricFormat;
  readonly higherIsBetter: boolean;
  readonly description: string;
}

export const metricDefinitions: readonly MetricDefinition[] = [
  { key: "spend", label: "Amount spent", shortLabel: "Spend", format: "money", higherIsBetter: false, description: "What you were charged for delivery." },
  { key: "impressions", label: "Impressions", shortLabel: "Impr.", format: "count", higherIsBetter: true, description: "Times your ads were on screen." },
  { key: "reach", label: "Reach", shortLabel: "Reach", format: "count", higherIsBetter: true, description: "People who saw your ads at least once." },
  { key: "frequency", label: "Frequency", shortLabel: "Freq.", format: "decimal", higherIsBetter: false, description: "Average times each person saw your ads." },
  { key: "clicks", label: "Clicks", shortLabel: "Clicks", format: "count", higherIsBetter: true, description: "Taps on your ad or its button." },
  { key: "ctr", label: "Click-through rate", shortLabel: "CTR", format: "percent", higherIsBetter: true, description: "Clicks divided by impressions." },
  { key: "cpc", label: "Cost per click", shortLabel: "CPC", format: "money", higherIsBetter: false, description: "Spend divided by clicks." },
  { key: "cpm", label: "Cost per 1,000 impressions", shortLabel: "CPM", format: "money", higherIsBetter: false, description: "Spend per 1,000 impressions." },
  { key: "conversions", label: "Purchases", shortLabel: "Purch.", format: "count", higherIsBetter: true, description: "Store orders attributed to your ads." },
  { key: "conversionValue", label: "Sales value", shortLabel: "Sales", format: "money", higherIsBetter: true, description: "Value of attributed orders." },
  { key: "roas", label: "Return on ad spend", shortLabel: "ROAS", format: "ratio", higherIsBetter: true, description: "Sales value divided by spend." },
  { key: "videoViews", label: "Video views", shortLabel: "Views", format: "count", higherIsBetter: true, description: "Plays of 3 seconds or more." },
  { key: "averageWatchPercent", label: "Average watch", shortLabel: "Avg. watch", format: "percent", higherIsBetter: true, description: "Average share of each video watched." },
  { key: "followersGained", label: "Followers gained", shortLabel: "Follows", format: "count", higherIsBetter: true, description: "New follows after seeing an ad." },
];

export function findMetricDefinition(key: MetricKey): MetricDefinition {
  return metricDefinitions.find((definition) => definition.key === key) ?? (metricDefinitions[0] as MetricDefinition);
}

export const breakdownOptions: readonly { readonly breakdown: ReportBreakdown; readonly label: string }[] = [
  { breakdown: "campaign", label: "Campaign" },
  { breakdown: "ad_set", label: "Ad set" },
  { breakdown: "ad", label: "Ad" },
  { breakdown: "placement", label: "Placement" },
  { breakdown: "day", label: "Day" },
  { breakdown: "country", label: "Country" },
  { breakdown: "state", label: "State / region" },
  { breakdown: "age", label: "Age" },
  { breakdown: "gender", label: "Gender" },
];

export const defaultReportColumns: readonly MetricKey[] = ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "conversions", "conversionValue", "roas"];
