import type { AutomationCondition, AutomationRuleContent, AutomationSampleEvent } from "@/types/automation.type";

export interface ConditionEvaluation {
  readonly condition: AutomationCondition;
  readonly actualValue: string;
  readonly isMet: boolean;
}

export interface AutomationDryRunResult {
  readonly isEventMatching: boolean;
  readonly conditionEvaluations: readonly ConditionEvaluation[];
  readonly wouldRunActions: boolean;
}

function evaluateSingleCondition(condition: AutomationCondition, payload: AutomationSampleEvent["payload"]): ConditionEvaluation {
  const rawActual = payload[condition.field];
  const actualValue = rawActual === undefined ? "" : String(rawActual);
  const expected = condition.value.trim();
  const actualNumber = Number(actualValue);
  const expectedNumber = Number(expected);
  const areBothNumbers = actualValue !== "" && expected !== "" && !Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber);
  const isMetByOperator: Record<AutomationCondition["operator"], () => boolean> = {
    EQUALS: () => (areBothNumbers ? actualNumber === expectedNumber : actualValue.toLowerCase() === expected.toLowerCase()),
    NOT_EQUALS: () => (areBothNumbers ? actualNumber !== expectedNumber : actualValue.toLowerCase() !== expected.toLowerCase()),
    GREATER_THAN: () => areBothNumbers && actualNumber > expectedNumber,
    LESS_THAN: () => areBothNumbers && actualNumber < expectedNumber,
    CONTAINS: () => actualValue.toLowerCase().includes(expected.toLowerCase()),
    IN: () => expected.split(",").map((option) => option.trim().toLowerCase()).includes(actualValue.toLowerCase()),
  };
  return { condition, actualValue, isMet: rawActual !== undefined && isMetByOperator[condition.operator]() };
}

export function evaluateAutomationRuleAgainstSampleEvent(rule: AutomationRuleContent, sampleEvent: AutomationSampleEvent): AutomationDryRunResult {
  const isEventMatching = rule.event === sampleEvent.event;
  const conditionEvaluations = rule.conditions.map((condition) => evaluateSingleCondition(condition, sampleEvent.payload));
  const areConditionsMet = conditionEvaluations.length === 0 || (rule.conditionMatch === "ALL" ? conditionEvaluations.every((evaluation) => evaluation.isMet) : conditionEvaluations.some((evaluation) => evaluation.isMet));
  return { isEventMatching, conditionEvaluations, wouldRunActions: isEventMatching && areConditionsMet && rule.isEnabled };
}
