import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import type { ExperimentContent, ExperimentVariant } from "@/types/featureFlags.type";

import { WholeNumberField } from "../shared/configurationFields";
import styles from "./featureFlags.module.css";

export const blankExperimentContent: ExperimentContent = { name: "", hypothesis: "", status: "DRAFT", primaryMetric: "", startedAt: null, variants: [{ key: "control", description: "Current experience", weightPercent: 50 }, { key: "treatment", description: "New experience", weightPercent: 50 }] };

export function findExperimentDraftProblem(experiment: ExperimentContent): string | null {
  const totalWeight = experiment.variants.reduce((total, variant) => total + variant.weightPercent, 0);
  if (experiment.name.trim().length < 3) return "Give the experiment a name.";
  if (experiment.variants.length < 2) return "An experiment needs at least two variants.";
  if (totalWeight !== 100) return `Variant weights add up to ${totalWeight}%. They must add up to 100%.`;
  if (experiment.variants.some((variant) => variant.key.length < 2 || variant.description.trim().length < 2)) return "Each variant needs a key and a description (at least 2 characters).";
  if (experiment.hypothesis.trim().length < 5 || experiment.primaryMetric.length < 3) return "Add a hypothesis and a primary metric.";
  if (new Set(experiment.variants.map((variant) => variant.key)).size !== experiment.variants.length) return "Variant keys must be unique.";
  return null;
}

export function ExperimentEditor({ experiment, savedStatus, canWrite, onChange }: { readonly experiment: ExperimentContent; readonly savedStatus: ExperimentContent["status"] | null; readonly canWrite: boolean; readonly onChange: (updater: (current: ExperimentContent) => ExperimentContent) => void }) {
  const isRunning = savedStatus === "RUNNING";
  const isStopped = savedStatus === "STOPPED";
  const isDisabled = !canWrite || isStopped;
  const areVariantsLocked = isDisabled || isRunning;
  const totalWeight = experiment.variants.reduce((total, variant) => total + variant.weightPercent, 0);
  const updateVariantAt = (index: number, changes: Partial<ExperimentVariant>) => onChange((current) => ({ ...current, variants: current.variants.map((variant, candidateIndex) => (candidateIndex === index ? { ...variant, ...changes } : variant)) }));
  const statusOptions = isRunning ? ["RUNNING", "STOPPED"] : isStopped ? ["STOPPED"] : ["DRAFT", "RUNNING", "STOPPED"];
  return (
    <div className={styles.editor}>
      <TextField label="Name" value={experiment.name} maxLength={80} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} />
      <TextAreaField label="Hypothesis" value={experiment.hypothesis} rows={2} maxLength={400} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, hypothesis: event.target.value }))} />
      <div className={styles.twoFields}>
        <TextField label="Primary metric" value={experiment.primaryMetric} maxLength={60} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, primaryMetric: event.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() }))} />
        <SelectField label="Status" value={experiment.status} disabled={isDisabled} options={statusOptions.map((status) => ({ value: status, label: status.charAt(0) + status.slice(1).toLowerCase() }))} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value as ExperimentContent["status"] }))} />
      </div>
      {isRunning ? <p className={styles.note}>Variants and weights are locked while the experiment runs. Stop it to end the test.</p> : null}
      {isStopped ? <p className={styles.note}>Stopped experiments can't restart. Create a new one instead.</p> : null}
      <fieldset className={styles.variants}>
        <legend>
          Variants · total <strong className={totalWeight === 100 ? undefined : styles.weightError}>{totalWeight}%</strong>
        </legend>
        {experiment.variants.map((variant, index) => (
          <div key={index} className={styles.variantRow}>
            <TextField label="Key" value={variant.key} disabled={areVariantsLocked} onChange={(event) => updateVariantAt(index, { key: event.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })} />
            <TextField label="Description" value={variant.description} disabled={areVariantsLocked} onChange={(event) => updateVariantAt(index, { description: event.target.value })} />
            <WholeNumberField label="Weight %" value={variant.weightPercent} maximum={100} isDisabled={areVariantsLocked} onChange={(weightPercent) => updateVariantAt(index, { weightPercent })} />
            {!areVariantsLocked && experiment.variants.length > 2 ? <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${variant.key}`} onClick={() => onChange((current) => ({ ...current, variants: current.variants.filter((_, candidateIndex) => candidateIndex !== index) }))} /> : null}
          </div>
        ))}
        {!areVariantsLocked && experiment.variants.length < 6 ? (
          <Button size="small" iconName="plus16" onClick={() => onChange((current) => ({ ...current, variants: [...current.variants, { key: `variant_${current.variants.length}`, description: "New variant", weightPercent: 0 }] }))}>
            Add variant
          </Button>
        ) : null}
      </fieldset>
    </div>
  );
}
