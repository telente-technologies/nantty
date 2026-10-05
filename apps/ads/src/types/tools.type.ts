import type { AdPlacement } from "@/types/campaign.type";

export type ConversionEventType = "purchase" | "add_to_cart" | "checkout_started" | "message_started" | "profile_follow" | "store_visit";

export interface ConversionEvent {
  readonly id: string;
  readonly name: string;
  readonly eventType: ConversionEventType;
  readonly storeId: string;
  readonly storeName: string;
  readonly isBuiltIn: boolean;
  readonly status: "active" | "no_recent_activity" | "paused";
  readonly lastReceivedAt: string | null;
  readonly countLast7Days: number;
  readonly tracksValue: boolean;
}

export interface ConversionEventInput {
  readonly name: string;
  readonly eventType: ConversionEventType;
  readonly storeId: string;
  readonly tracksValue: boolean;
}

export type ExperimentVariable = "audience" | "creative" | "placement" | "bid_strategy";
export type ExperimentStatus = "draft" | "running" | "completed" | "stopped";
export type ExperimentMetric = "cost_per_result" | "ctr" | "roas" | "conversions";

export interface ExperimentArm {
  readonly adSetId: string;
  readonly adSetName: string;
  readonly trafficPercent: number;
  readonly note: string;
}

export interface Experiment {
  readonly id: string;
  readonly name: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly variable: ExperimentVariable;
  readonly metric: ExperimentMetric;
  readonly status: ExperimentStatus;
  readonly arms: readonly ExperimentArm[];
  readonly startAt: string;
  readonly endAt: string;
  readonly result: { readonly winnerAdSetId: string | null; readonly confidencePercent: number; readonly summary: string } | null;
  readonly createdAt: string;
}

export interface ExperimentInput {
  readonly name: string;
  readonly campaignId: string;
  readonly variable: ExperimentVariable;
  readonly metric: ExperimentMetric;
  readonly arms: readonly { readonly adSetId: string; readonly trafficPercent: number }[];
  readonly startAt: string;
  readonly endAt: string;
}

export type RuleLevel = "campaign" | "ad_set" | "ad";
export type RuleMetric = "cpc" | "cpm" | "ctr" | "spend" | "cost_per_result" | "frequency" | "roas" | "impressions";
export type RuleOperator = "greater_than" | "less_than";
export type RuleWindow = "today" | "last_3_days" | "last_7_days" | "lifetime";
export type RuleActionType = "pause" | "notify" | "increase_budget" | "decrease_budget";

export interface RuleCondition {
  readonly metric: RuleMetric;
  readonly operator: RuleOperator;
  readonly value: number;
  readonly window: RuleWindow;
}

export interface AutomatedRule {
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "paused";
  readonly level: RuleLevel;
  readonly targetIds: readonly string[];
  readonly conditions: readonly RuleCondition[];
  readonly action: { readonly type: RuleActionType; readonly percent: number | null };
  readonly checkEveryMinutes: 30 | 60 | 1440;
  readonly lastRunAt: string | null;
  readonly lastTriggeredAt: string | null;
  readonly triggerCount: number;
  readonly createdAt: string;
}

export type AutomatedRuleInput = Pick<AutomatedRule, "name" | "level" | "targetIds" | "conditions" | "action" | "checkEveryMinutes">;

export interface ActivityChange {
  readonly field: string;
  readonly from: string | null;
  readonly to: string | null;
}

export type ActivityObjectType = "account" | "campaign" | "ad_set" | "ad" | "audience" | "billing" | "member" | "rule" | "experiment" | "conversion_event";

export interface ActivityEntryResponse {
  readonly id: string;
  readonly objectType: ActivityObjectType;
  readonly objectId: string;
  readonly actor: string;
  readonly summary: string;
  readonly changes: unknown;
  readonly createdAt: string;
}

export interface ActivityEntry {
  readonly id: string;
  readonly actor: { readonly id: string; readonly name: string; readonly isSystem: boolean };
  readonly action: string;
  readonly objectType: ActivityObjectType;
  readonly objectId: string;
  readonly objectName: string;
  readonly summary: string;
  readonly changes: readonly ActivityChange[];
  readonly createdAt: string;
}

export interface PlacementDescription {
  readonly placement: AdPlacement;
  readonly label: string;
  readonly description: string;
}
