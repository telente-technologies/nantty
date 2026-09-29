"use client";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/formFields";
import type { RuleCondition, RuleMetric, RuleOperator, RuleWindow } from "@/types/tools.type";
import { readCurrencySymbol } from "@/utils/money.util";

import { moneyRuleMetrics, ruleMetricLabels } from "./toolLabels.constant";
import styles from "./toolsPage.module.css";

export interface EditableRuleCondition {
  readonly metric: RuleMetric;
  readonly operator: RuleOperator;
  readonly typedValue: string;
  readonly window: RuleWindow;
}

const windowOptions: readonly { value: RuleWindow; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last_3_days", label: "Last 3 days" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "lifetime", label: "Lifetime" },
];

export function convertRuleConditionToEditable(condition: RuleCondition): EditableRuleCondition {
  return { metric: condition.metric, operator: condition.operator, typedValue: String(condition.value), window: condition.window };
}

export function convertEditableToRuleCondition(condition: EditableRuleCondition): RuleCondition | null {
  const value = Number(condition.typedValue.replace(/,/g, ""));
  if (!condition.typedValue.trim() || !Number.isFinite(value) || value < 0) return null;
  return { metric: condition.metric, operator: condition.operator, value, window: condition.window };
}

interface RuleConditionEditorProps {
  readonly index: number;
  readonly condition: EditableRuleCondition;
  readonly currency: string;
  readonly canRemove: boolean;
  readonly onChange: (condition: EditableRuleCondition) => void;
  readonly onRemove: () => void;
}

export function RuleConditionEditor({ index, condition, currency, canRemove, onChange, onRemove }: RuleConditionEditorProps) {
  const isMoneyMetric = moneyRuleMetrics.includes(condition.metric);
  return (
    <div className={styles.conditionEditor} role="group" aria-label={`Condition ${index + 1}`}>
      <SelectField label="Metric" value={condition.metric} onValueChange={(metric) => onChange({ ...condition, metric })} options={Object.entries(ruleMetricLabels).map(([value, label]) => ({ value: value as RuleMetric, label }))} />
      <SelectField
        label="Is"
        value={condition.operator}
        onValueChange={(operator) => onChange({ ...condition, operator })}
        options={[
          { value: "greater_than", label: "Greater than" },
          { value: "less_than", label: "Less than" },
        ]}
      />
      <TextField
        label="Value"
        inputMode="decimal"
        value={condition.typedValue}
        prefix={isMoneyMetric ? readCurrencySymbol(currency) : undefined}
        suffix={condition.metric === "ctr" ? "%" : condition.metric === "roas" ? "×" : undefined}
        onValueChange={(typedValue) => onChange({ ...condition, typedValue: typedValue.replace(/[^\d.,]/g, "") })}
      />
      <SelectField label="Over" value={condition.window} onValueChange={(window) => onChange({ ...condition, window })} options={windowOptions} />
      <Button variant="ghost" iconName="trash24" aria-label={`Remove condition ${index + 1}`} disabled={!canRemove} onClick={onRemove} />
    </div>
  );
}
