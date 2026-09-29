export type ConversionEventType = "purchase" | "add_to_cart" | "checkout_started" | "message_started" | "profile_follow" | "store_visit";
export type ConversionEventStatus = "active" | "no_recent_activity" | "paused";

export interface AdConversionEventRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly eventType: ConversionEventType;
  readonly storeId: string;
  readonly isBuiltIn: boolean;
  readonly status: ConversionEventStatus;
  readonly tracksValue: boolean;
  readonly createdAt: Date;
}

export type NewAdConversionEventInput = Omit<AdConversionEventRecord, "id">;

export type ExperimentVariable = "audience" | "creative" | "placement" | "bid_strategy";
export type ExperimentStatus = "draft" | "running" | "completed" | "stopped";
export type ExperimentMetric = "cost_per_result" | "ctr" | "roas" | "conversions";

export interface ExperimentArmRecord {
  readonly adSetId: string;
  readonly trafficPercent: number;
}

export interface ExperimentResult {
  readonly winnerAdSetId: string | null;
  readonly confidencePercent: number;
  readonly summary: string;
}

export interface AdExperimentRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly campaignId: string;
  readonly variable: ExperimentVariable;
  readonly metric: ExperimentMetric;
  readonly status: ExperimentStatus;
  readonly arms: readonly ExperimentArmRecord[];
  readonly startAt: Date;
  readonly endAt: Date;
  readonly result: ExperimentResult | null;
  readonly createdAt: Date;
}

export type NewAdExperimentInput = Omit<AdExperimentRecord, "id">;

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

export interface RuleAction {
  readonly type: RuleActionType;
  readonly percent: number | null;
}

export interface AdAutomatedRuleRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly status: "active" | "paused";
  readonly level: RuleLevel;
  readonly targetIds: readonly string[];
  readonly conditions: readonly RuleCondition[];
  readonly action: RuleAction;
  readonly checkEveryMinutes: 30 | 60 | 1440;
  readonly lastRunAt: Date | null;
  readonly lastTriggeredAt: Date | null;
  readonly triggerCount: number;
  readonly createdAt: Date;
}

export type NewAdAutomatedRuleInput = Omit<AdAutomatedRuleRecord, "id" | "lastRunAt" | "lastTriggeredAt" | "triggerCount">;
export type AdAutomatedRuleChanges = Partial<Omit<AdAutomatedRuleRecord, "id" | "accountId" | "createdAt">>;

export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface AdScheduledReportRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly recipientsCiphertext: string;
  readonly recipientCount: number;
  readonly frequency: ReportFrequency;
  readonly breakdown: string;
  readonly metrics: readonly string[];
  readonly nextSendAt: Date;
  readonly createdById: string;
  readonly createdAt: Date;
}

export type NewAdScheduledReportInput = Omit<AdScheduledReportRecord, "id">;
