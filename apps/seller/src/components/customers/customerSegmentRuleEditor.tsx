"use client";

import { IconButton } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/formFields";
import type { CurrencyCode } from "@/types/money.type";
import type { CustomerSegmentRule, CustomerSegmentRuleField, CustomerSegmentRuleOperator } from "@/types/customer.type";
import { customerSegmentRuleFieldLabels, moneyRuleFields, numberRuleFields, textRuleFields } from "@/utils/customerSegmentRules.util";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./customerSegments.module.css";

const operatorLabels: Record<CustomerSegmentRuleOperator, string> = { at_least: "at least", at_most: "at most", equals: "exactly" };

export function buildDefaultValueForRuleField(field: CustomerSegmentRuleField): CustomerSegmentRule["value"] {
  if (field === "marketing_opt_in") return true;
  if (textRuleFields.includes(field)) return "";
  return 0;
}

export function CustomerSegmentRuleEditor({ rule, currency, errorMessage, onRuleChange, onRemove }: { readonly rule: CustomerSegmentRule; readonly currency: CurrencyCode; readonly errorMessage?: string; readonly onRuleChange: (rule: CustomerSegmentRule) => void; readonly onRemove: () => void }) {
  const isMoneyField = moneyRuleFields.includes(rule.field);
  const isNumberField = numberRuleFields.includes(rule.field);
  const isTextField = textRuleFields.includes(rule.field);

  function changeField(field: CustomerSegmentRuleField) {
    onRuleChange({ field, operator: isNumberOrMoney(field) ? "at_least" : "equals", value: buildDefaultValueForRuleField(field) });
  }

  return (
    <div className={styles.ruleRow}>
      <SelectField label="Field" hideLabel value={rule.field} onChange={(event) => changeField(event.target.value as CustomerSegmentRuleField)} options={(Object.keys(customerSegmentRuleFieldLabels) as CustomerSegmentRuleField[]).map((field) => ({ value: field, label: customerSegmentRuleFieldLabels[field] }))} />
      {isMoneyField || isNumberField ? (
        <SelectField label="Comparison" hideLabel value={rule.operator} onChange={(event) => onRuleChange({ ...rule, operator: event.target.value as CustomerSegmentRuleOperator })} options={(Object.keys(operatorLabels) as CustomerSegmentRuleOperator[]).map((operator) => ({ value: operator, label: operatorLabels[operator] }))} />
      ) : (
        <span className={styles.ruleWord}>is</span>
      )}
      {isMoneyField ? (
        <TextField label="Amount" hideLabel prefix={currency} inputMode="decimal" value={convertMinorUnitsToMajorInputText(Number(rule.value) || 0, currency)} onChange={(event) => onRuleChange({ ...rule, value: convertMajorInputToMinorUnits(event.target.value || "0", currency) ?? 0 })} errorMessage={errorMessage} />
      ) : null}
      {isNumberField ? <TextField label="Number" hideLabel inputMode="numeric" value={String(rule.value)} onChange={(event) => onRuleChange({ ...rule, value: Number(event.target.value.replace(/\D/g, "") || "0") })} errorMessage={errorMessage} /> : null}
      {isTextField ? <TextField label="Value" hideLabel placeholder={rule.field === "city" ? "e.g. Ikeja" : "e.g. vip"} maxLength={40} value={String(rule.value)} onChange={(event) => onRuleChange({ ...rule, value: event.target.value })} errorMessage={errorMessage} /> : null}
      {rule.field === "marketing_opt_in" ? <SelectField label="Value" hideLabel value={rule.value ? "yes" : "no"} onChange={(event) => onRuleChange({ ...rule, value: event.target.value === "yes" })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /> : null}
      <IconButton iconName="trash24" label="Remove rule" size="small" onClick={onRemove} />
    </div>
  );
}

function isNumberOrMoney(field: CustomerSegmentRuleField): boolean {
  return moneyRuleFields.includes(field) || numberRuleFields.includes(field);
}

export function describeSegmentRuleInWords(rule: CustomerSegmentRule, formatMinorAmount: (amountMinor: number) => string): string {
  const fieldLabel = customerSegmentRuleFieldLabels[rule.field];
  if (rule.field === "marketing_opt_in") return rule.value ? "Accepts offers" : "Does not accept offers";
  if (textRuleFields.includes(rule.field)) return `${fieldLabel} “${String(rule.value)}”`;
  const value = moneyRuleFields.includes(rule.field) ? formatMinorAmount(Number(rule.value)) : String(rule.value);
  return `${fieldLabel} ${operatorLabels[rule.operator]} ${value}`;
}
