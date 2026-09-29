export const AUTOMATION_TRIGGERS = [
  "moderation.report_submitted",
  "stores.store_created",
  "stores.seller_application_submitted",
  "messages.message_sent",
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const CONDITION_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "exists"] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const AUTOMATION_ACTION_TYPES = ["hide_target", "queue_for_review", "flag_user"] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export type ConditionValue = string | number | boolean | readonly (string | number)[] | null;

export interface RuleCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value?: ConditionValue;
}

export interface RuleActionParameters {
  readonly priority?: number;
  readonly userField?: string;
}

export interface RuleAction {
  readonly type: AutomationActionType;
  readonly params?: RuleActionParameters;
}

export interface RuleThreshold {
  readonly count: number;
  readonly withinSeconds: number;
}

export interface AutomationRuleRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: AutomationTrigger;
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
  readonly threshold: RuleThreshold | null;
  readonly cooldownSeconds: number | null;
  readonly maxExecutionsPerHour: number;
  readonly enabled: boolean;
  readonly createdById: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewAutomationRule = Omit<AutomationRuleRecord, "id" | "createdAt" | "updatedAt">;
export type AutomationRuleChanges = Partial<Omit<NewAutomationRule, "createdById">>;

export type ExecutionStatus = "succeeded" | "skipped" | "suppressed" | "rate_limited" | "failed";

export interface ExecutionStep {
  readonly kind: "condition" | "threshold" | "cooldown" | "rate_limit" | "action";
  readonly name: string;
  readonly outcome: "passed" | "failed" | "error";
  readonly detail?: string;
}

export type AutomationEventData = Readonly<Record<string, string | number | boolean | null>>;

export interface AutomationExecutionRecord {
  readonly id: string;
  readonly ruleId: string;
  readonly trigger: AutomationTrigger;
  readonly subjectKey: string;
  readonly status: ExecutionStatus;
  readonly steps: readonly ExecutionStep[];
  readonly input: AutomationEventData;
  readonly error: string | null;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}

export type NewAutomationExecution = Omit<AutomationExecutionRecord, "id">;

export interface AutomationEvent {
  readonly trigger: AutomationTrigger;
  readonly subjectKey: string;
  readonly data: AutomationEventData;
}
