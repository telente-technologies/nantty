import type { ConversionEventType, ExperimentMetric, ExperimentStatus, ExperimentVariable, RuleActionType, RuleLevel, RuleMetric, RuleWindow } from "@/types/tools.type";

export const conversionEventTypeLabels: Record<ConversionEventType, string> = {
  purchase: "Purchase",
  add_to_cart: "Add to cart",
  checkout_started: "Checkout started",
  message_started: "Message started",
  profile_follow: "Profile follow",
  store_visit: "Store visit",
};

export const experimentVariableLabels: Record<ExperimentVariable, string> = {
  audience: "Audience",
  creative: "Creative",
  placement: "Placements",
  bid_strategy: "Bid strategy",
};

export const experimentMetricLabels: Record<ExperimentMetric, string> = {
  cost_per_result: "Lowest cost per result",
  ctr: "Highest click-through rate",
  roas: "Highest return on ad spend",
  conversions: "Most purchases",
};

export const experimentStatusDisplay: Record<ExperimentStatus, { label: string; tone: "neutral" | "info" | "success" | "caution" }> = {
  draft: { label: "Scheduled", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  stopped: { label: "Stopped", tone: "caution" },
};

export const ruleMetricLabels: Record<RuleMetric, string> = {
  cpc: "Cost per click",
  cpm: "Cost per 1,000 impressions",
  ctr: "Click-through rate",
  spend: "Amount spent",
  cost_per_result: "Cost per result",
  frequency: "Frequency",
  roas: "Return on ad spend",
  impressions: "Impressions",
};

export const ruleMetricShortLabels: Record<RuleMetric, string> = {
  cpc: "CPC",
  cpm: "CPM",
  ctr: "CTR",
  spend: "Spend",
  cost_per_result: "Cost per result",
  frequency: "Frequency",
  roas: "ROAS",
  impressions: "Impressions",
};

export const moneyRuleMetrics: readonly RuleMetric[] = ["cpc", "cpm", "spend", "cost_per_result"];

export const ruleWindowLabels: Record<RuleWindow, string> = {
  today: "today",
  last_3_days: "over the last 3 days",
  last_7_days: "over the last 7 days",
  lifetime: "over the lifetime",
};

export const ruleLevelLabels: Record<RuleLevel, string> = { campaign: "Campaigns", ad_set: "Ad sets", ad: "Ads" };

export const ruleActionLabels: Record<RuleActionType, string> = {
  pause: "Pause it",
  notify: "Notify me only",
  increase_budget: "Increase budget",
  decrease_budget: "Decrease budget",
};

export const ruleCheckFrequencyOptions: readonly { value: "30" | "60" | "1440"; label: string }[] = [
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
  { value: "1440", label: "Once a day" },
];
