import type { AutomatedRule, RuleCondition } from "@/types/tools.type";
import { readCurrencySymbol } from "@/utils/money.util";
import { formatWholeCount } from "@/utils/numberFormatting.util";

import { moneyRuleMetrics, ruleActionLabels, ruleLevelLabels, ruleMetricShortLabels, ruleWindowLabels } from "./toolLabels.constant";

export function formatRuleThresholdValue(condition: RuleCondition, currency: string): string {
  if (moneyRuleMetrics.includes(condition.metric)) return `${readCurrencySymbol(currency)}${formatWholeCount(condition.value)}`;
  if (condition.metric === "ctr") return `${condition.value}%`;
  if (condition.metric === "roas") return `${condition.value}×`;
  if (condition.metric === "impressions") return formatWholeCount(condition.value);
  return String(condition.value);
}

export function describeRuleConditionInPlainEnglish(condition: RuleCondition, currency: string): string {
  const comparison = condition.operator === "greater_than" ? "is greater than" : "is less than";
  return `${ruleMetricShortLabels[condition.metric]} ${comparison} ${formatRuleThresholdValue(condition, currency)} ${ruleWindowLabels[condition.window]}`;
}

export function describeRuleActionInPlainEnglish(rule: Pick<AutomatedRule, "action" | "level" | "targetIds">): string {
  const scope = rule.targetIds.length > 0 ? `${rule.targetIds.length} selected ${ruleLevelLabels[rule.level].toLowerCase()}` : `all active ${ruleLevelLabels[rule.level].toLowerCase()}`;
  if (rule.action.type === "increase_budget" || rule.action.type === "decrease_budget") {
    return `${rule.action.type === "increase_budget" ? "Raise" : "Lower"} the budget by ${rule.action.percent ?? 0}% · applies to ${scope}`;
  }
  return `${ruleActionLabels[rule.action.type]} · applies to ${scope}`;
}
