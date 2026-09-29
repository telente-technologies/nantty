export type AutomationFieldType = "number" | "text" | "boolean" | "money";
export type AutomationOperator = "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS" | "IN";

export interface AutomationEventDefinition {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly { readonly key: string; readonly label: string; readonly type: AutomationFieldType }[];
}

export interface AutomationActionDefinition {
  readonly type: string;
  readonly label: string;
  readonly parameters: readonly { readonly key: string; readonly label: string }[];
}

export interface AutomationCatalog {
  readonly events: readonly AutomationEventDefinition[];
  readonly operators: readonly { readonly key: AutomationOperator; readonly label: string }[];
  readonly actions: readonly AutomationActionDefinition[];
}

export interface AutomationCondition {
  readonly field: string;
  readonly operator: AutomationOperator;
  readonly value: string;
}

export interface AutomationAction {
  readonly type: string;
  readonly parameters: Readonly<Record<string, string>>;
}

export interface AutomationRuleContent {
  readonly name: string;
  readonly description: string;
  readonly isEnabled: boolean;
  readonly event: string;
  readonly conditionMatch: "ALL" | "ANY";
  readonly conditions: readonly AutomationCondition[];
  readonly actions: readonly AutomationAction[];
}

export interface AutomationSampleEvent {
  readonly id: string;
  readonly event: string;
  readonly label: string;
  readonly payload: Readonly<Record<string, string | number | boolean>>;
}

export interface AutomationExecution {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly event: string;
  readonly subjectLabel: string;
  readonly occurredAt: string;
  readonly outcome: "ACTIONS_RUN" | "CONDITIONS_NOT_MET" | "FAILED";
  readonly actionsRun: readonly string[];
  readonly errorMessage: string | null;
}
