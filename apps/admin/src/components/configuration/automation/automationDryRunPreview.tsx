"use client";

import { useState } from "react";

import { SelectField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import type { AutomationCatalog, AutomationRuleContent, AutomationSampleEvent } from "@/types/automation.type";
import { evaluateAutomationRuleAgainstSampleEvent } from "@/utils/automationRuleEvaluation.util";

import styles from "./automation.module.css";

export function AutomationDryRunPreview({ rule, catalog, sampleEvents }: { readonly rule: AutomationRuleContent; readonly catalog: AutomationCatalog; readonly sampleEvents: readonly AutomationSampleEvent[] }) {
  const matchingSamples = sampleEvents.filter((sample) => sample.event === rule.event);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const sample = matchingSamples.find((candidate) => candidate.id === selectedSampleId) ?? matchingSamples[0] ?? null;
  if (!sample) return <p className={styles.note}>No sample events exist for {rule.event} yet.</p>;
  const result = evaluateAutomationRuleAgainstSampleEvent(rule, sample);
  const operatorLabel = (key: string) => catalog.operators.find((operator) => operator.key === key)?.label ?? key;
  const actionLabel = (type: string) => catalog.actions.find((definition) => definition.type === type)?.label ?? type;
  return (
    <section className={styles.dryRun} aria-label="Dry run">
      <h3 className={styles.stepTitle}>Dry run — nothing is executed</h3>
      <SelectField label="Sample event" value={sample.id} options={matchingSamples.map((candidate) => ({ value: candidate.id, label: candidate.label }))} onChange={(event) => setSelectedSampleId(event.target.value)} />
      <pre className={styles.payload}>{JSON.stringify(sample.payload, null, 2)}</pre>
      <ul className={styles.evaluations}>
        {result.conditionEvaluations.map((evaluation, index) => (
          <li key={index}>
            <StatusBadge label={evaluation.isMet ? "Met" : "Not met"} tone={evaluation.isMet ? "success" : "neutral"} />
            <code>
              {evaluation.condition.field} {operatorLabel(evaluation.condition.operator)} {evaluation.condition.value}
            </code>
            <span className={styles.note}>actual: {evaluation.actualValue || "missing"}</span>
          </li>
        ))}
      </ul>
      {result.wouldRunActions ? (
        <p className={styles.outcomeRun}>Would run: {rule.actions.map((action) => actionLabel(action.type)).join(", ")}.</p>
      ) : (
        <p className={styles.outcomeSkip}>{rule.isEnabled ? "Conditions not met — no actions would run." : "The rule is off, so no actions would run."}</p>
      )}
    </section>
  );
}
