"use client";

import { createDraftKey, type OptionDraft } from "@/components/catalog/productEditorDraft.util";
import { Button, IconButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";

import styles from "./productEditor.module.css";

const maximumOptions = 3;

export function ProductOptionsSection({ options, fieldErrors, onOptionsChange }: { readonly options: OptionDraft[]; readonly fieldErrors: Record<string, string>; readonly onOptionsChange: (options: OptionDraft[]) => void }) {
  function updateOption(optionKey: string, patch: Partial<OptionDraft>) {
    onOptionsChange(options.map((option) => (option.key === optionKey ? { ...option, ...patch } : option)));
  }
  return (
    <Panel
      title="Options"
      description="Add options like Size or Colour. Every combination becomes a variant with its own SKU, price and stock."
      actions={options.length < maximumOptions ? <Button size="small" iconName="plus16" onClick={() => onOptionsChange([...options, { key: createDraftKey(), name: options.length === 0 ? "Size" : options.length === 1 ? "Colour" : "", valuesText: "" }])}>Add option</Button> : null}
    >
      {options.length === 0 ? <p className={styles.muted}>This product has one variant. Add an option if it comes in sizes, colours or other choices.</p> : null}
      {options.map((option, optionIndex) => (
        <div key={option.key} className={styles.optionRow}>
          <TextField label={`Option ${optionIndex + 1} name`} value={option.name} maxLength={30} onChange={(event) => updateOption(option.key, { name: event.target.value })} errorMessage={fieldErrors[`options.${optionIndex}.name`]} />
          <TextField label="Values" value={option.valuesText} onChange={(event) => updateOption(option.key, { valuesText: event.target.value })} hint="Separate with commas, for example S, M, L, XL." errorMessage={fieldErrors[`options.${optionIndex}.values`]} maxLength={1200} />
          <IconButton iconName="trash24" label={`Remove option ${option.name || optionIndex + 1}`} onClick={() => onOptionsChange(options.filter((candidate) => candidate.key !== option.key))} />
        </div>
      ))}
      {fieldErrors.options ? <p role="alert" style={{ color: "var(--error-ink)", fontSize: 12, marginTop: 8 }}>{fieldErrors.options}</p> : null}
    </Panel>
  );
}
