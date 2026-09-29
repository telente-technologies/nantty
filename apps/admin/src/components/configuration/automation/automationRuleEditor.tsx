import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import type { AutomationAction, AutomationCatalog, AutomationCondition, AutomationRuleContent } from "@/types/automation.type";

import styles from "./automation.module.css";

interface AutomationRuleEditorProps {
  readonly rule: AutomationRuleContent;
  readonly catalog: AutomationCatalog;
  readonly canWrite: boolean;
  readonly onChange: (updater: (current: AutomationRuleContent) => AutomationRuleContent) => void;
}

export function findAutomationRuleDraftProblem(rule: AutomationRuleContent): string | null {
  if (rule.name.trim().length < 3) return "Name the rule (at least 3 characters).";
  if (rule.actions.length === 0) return "Add at least one action.";
  if (rule.conditions.some((condition) => condition.value.trim() === "")) return "Every condition needs a value.";
  if (rule.actions.some((action) => Object.values(action.parameters).some((value) => value.trim() === ""))) return "Fill in every action setting.";
  return null;
}

export function AutomationRuleEditor({ rule, catalog, canWrite, onChange }: AutomationRuleEditorProps) {
  const isDisabled = !canWrite;
  const eventDefinition = catalog.events.find((definition) => definition.key === rule.event) ?? catalog.events[0];
  const fieldOptions = (eventDefinition?.fields ?? []).map((field) => ({ value: field.key, label: field.label }));
  const updateConditionAt = (index: number, changes: Partial<AutomationCondition>) => onChange((current) => ({ ...current, conditions: current.conditions.map((condition, candidateIndex) => (candidateIndex === index ? { ...condition, ...changes } : condition)) }));
  const updateActionAt = (index: number, action: AutomationAction) => onChange((current) => ({ ...current, actions: current.actions.map((candidate, candidateIndex) => (candidateIndex === index ? action : candidate)) }));
  const buildActionWithDefaults = (type: string): AutomationAction => ({ type, parameters: Object.fromEntries((catalog.actions.find((definition) => definition.type === type)?.parameters ?? []).map((parameter) => [parameter.key, ""])) });

  return (
    <div className={styles.editor}>
      <TextField label="Rule name" value={rule.name} maxLength={80} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} />
      <TextAreaField label="What it's for" value={rule.description} rows={2} maxLength={300} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} />
      <CheckboxField label="Rule is on" description="Off rules are kept but never run." checked={rule.isEnabled} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, isEnabled: event.target.checked }))} />
      <section className={styles.step}>
        <h3 className={styles.stepTitle}>When</h3>
        <SelectField label="Event" value={rule.event} disabled={isDisabled} options={catalog.events.map((definition) => ({ value: definition.key, label: `${definition.label} (${definition.key})` }))} onChange={(event) => onChange((current) => ({ ...current, event: event.target.value, conditions: [] }))} />
      </section>
      <section className={styles.step}>
        <h3 className={styles.stepTitle}>
          If
          <select className={styles.inlineSelect} aria-label="How conditions combine" value={rule.conditionMatch} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, conditionMatch: event.target.value === "ANY" ? "ANY" : "ALL" }))}>
            <option value="ALL">all of these are true</option>
            <option value="ANY">any of these is true</option>
          </select>
        </h3>
        {rule.conditions.length === 0 ? <p className={styles.note}>No conditions: the rule runs on every {eventDefinition?.label.toLowerCase() ?? "event"}.</p> : null}
        {rule.conditions.map((condition, index) => (
          <div key={index} className={styles.conditionRow}>
            <SelectField label="Field" isLabelHidden value={condition.field} disabled={isDisabled} options={fieldOptions} onChange={(event) => updateConditionAt(index, { field: event.target.value })} />
            <SelectField label="Operator" isLabelHidden value={condition.operator} disabled={isDisabled} options={catalog.operators.map((operator) => ({ value: operator.key, label: operator.label }))} onChange={(event) => updateConditionAt(index, { operator: event.target.value as AutomationCondition["operator"] })} />
            <TextField label="Value" isLabelHidden value={condition.value} placeholder="Value" disabled={isDisabled} onChange={(event) => updateConditionAt(index, { value: event.target.value })} />
            {!isDisabled ? <Button size="small" variant="ghost" iconName="trash24" aria-label="Remove condition" onClick={() => onChange((current) => ({ ...current, conditions: current.conditions.filter((_, candidateIndex) => candidateIndex !== index) }))} /> : null}
          </div>
        ))}
        {!isDisabled && rule.conditions.length < 10 && fieldOptions[0] ? (
          <Button size="small" iconName="plus16" onClick={() => onChange((current) => ({ ...current, conditions: [...current.conditions, { field: fieldOptions[0]!.value, operator: "EQUALS", value: "" }] }))}>
            Add condition
          </Button>
        ) : null}
      </section>
      <section className={styles.step}>
        <h3 className={styles.stepTitle}>Then</h3>
        {rule.actions.map((action, index) => {
          const definition = catalog.actions.find((candidate) => candidate.type === action.type);
          return (
            <div key={index} className={styles.actionBlock}>
              <div className={styles.actionHeader}>
                <SelectField label="Action" isLabelHidden value={action.type} disabled={isDisabled} options={catalog.actions.map((candidate) => ({ value: candidate.type, label: candidate.label }))} onChange={(event) => updateActionAt(index, buildActionWithDefaults(event.target.value))} />
                {!isDisabled ? <Button size="small" variant="ghost" iconName="trash24" aria-label="Remove action" onClick={() => onChange((current) => ({ ...current, actions: current.actions.filter((_, candidateIndex) => candidateIndex !== index) }))} /> : null}
              </div>
              {(definition?.parameters ?? []).map((parameter) => (
                <TextField key={parameter.key} label={parameter.label} value={action.parameters[parameter.key] ?? ""} disabled={isDisabled} onChange={(event) => updateActionAt(index, { ...action, parameters: { ...action.parameters, [parameter.key]: event.target.value } })} />
              ))}
            </div>
          );
        })}
        {!isDisabled && rule.actions.length < 6 && catalog.actions[0] ? (
          <Button size="small" iconName="plus16" onClick={() => onChange((current) => ({ ...current, actions: [...current.actions, buildActionWithDefaults(catalog.actions[0]!.type)] }))}>
            Add action
          </Button>
        ) : null}
      </section>
    </div>
  );
}
