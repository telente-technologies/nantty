"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { OptionValuesInput } from "@/components/catalog/optionValuesInput";
import { applyOptionChanges, createOptionDraft, describeVariantDraftTitle, findDroppedVariantDrafts, variantDraftHasStock, type OptionDraft, type VariantDraft } from "@/components/catalog/productEditorDraft.util";
import { countOptionCombinations, describeOptionGroupProblem, isSameOptionText, optionNameSuggestions, productOptionLimits } from "@/components/catalog/productOptions.util";
import { Button, IconButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";

import styles from "./productOptions.module.css";

type OptionsUpdate = (options: readonly OptionDraft[]) => OptionDraft[];

interface ProductOptionsSectionProps {
  readonly options: readonly OptionDraft[];
  readonly variants: readonly VariantDraft[];
  readonly fieldErrors: Record<string, string>;
  readonly blockedMessage?: string | null;
  readonly onOptionsChange: (update: OptionsUpdate) => void;
}

function describeDroppedVariants(dropped: readonly VariantDraft[], options: readonly OptionDraft[]): string | null {
  const meaningful = dropped.filter((variant) => variant.id !== null || variantDraftHasStock(variant));
  if (meaningful.length === 0) return null;
  const names = meaningful.slice(0, 3).map((variant) => describeVariantDraftTitle(variant, options)).join(", ");
  const withStock = meaningful.filter(variantDraftHasStock).length;
  const subject = meaningful.length === 1 ? `The variant ${names} will be removed` : `${meaningful.length} variants (${names}${meaningful.length > 3 ? ", …" : ""}) will be removed`;
  return withStock > 0
    ? `${subject}, with its SKU and price. ${withStock === 1 ? "One of them still has" : `${withStock} of them still have`} stock, so saving is blocked until you adjust that stock to zero.`
    : `${subject}, with ${meaningful.length === 1 ? "its SKU and price" : "their SKUs and prices"}.`;
}

export function ProductOptionsSection({ options, variants, fieldErrors, blockedMessage, onOptionsChange }: ProductOptionsSectionProps) {
  const [announcement, setAnnouncement] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const lastOption = options[options.length - 1];
  const canAddOption = options.length < productOptionLimits.maxGroups && (lastOption === undefined || lastOption.values.length > 0);
  const suggestions = optionNameSuggestions.filter((name) => !options.some((option) => isSameOptionText(option.name, name) || (name === "Colour" && isSameOptionText(option.name, "Color"))));
  const combinations = countOptionCombinations(options);

  const announce = (message: string) => setAnnouncement((current) => (current === message ? `${message}\u00a0` : message));
  const updateOption = (key: string, patch: Partial<OptionDraft>) => onOptionsChange((current) => current.map((option) => (option.key === key ? { ...option, ...patch } : option)));

  function addOption(name: string) {
    const option = createOptionDraft(name);
    setFocusKey(option.key);
    onOptionsChange((current) => (current.length >= productOptionLimits.maxGroups ? [...current] : [...current, option]));
    announce(name ? `${name} option added.` : "Custom option added. Name it first.");
  }

  async function confirmRemoval(title: string, nextOptions: OptionDraft[], fallback: string | null): Promise<boolean> {
    const dropped = findDroppedVariantDrafts(variants, applyOptionChanges(nextOptions, variants).variants);
    const description = describeDroppedVariants(dropped, options) ?? fallback;
    if (!description) return true;
    return requestConfirmation({ title, description, confirmLabel: "Remove", intent: "remove" });
  }

  async function removeValue(option: OptionDraft, value: string) {
    const without = (list: readonly OptionDraft[]) => list.map((candidate) => (candidate.key === option.key ? { ...candidate, values: candidate.values.filter((existing) => existing !== value) } : candidate));
    if (!(await confirmRemoval(`Remove ${value}?`, without(options), null))) return;
    onOptionsChange(without);
    announce(`Removed ${value}.`);
  }

  async function removeOption(option: OptionDraft) {
    const label = option.name.trim() || "this option";
    const fallback = option.values.length > 0 ? `This removes ${label} and its ${option.values.length} ${option.values.length === 1 ? "value" : "values"}.` : null;
    if (!(await confirmRemoval(`Remove ${label}?`, options.filter((candidate) => candidate.key !== option.key), fallback))) return;
    onOptionsChange((current) => current.filter((candidate) => candidate.key !== option.key));
    announce(`Removed ${label} option.`);
  }

  return (
    <Panel title="Options" description="Add options like Size or Colour. Every combination becomes a variant with its own SKU, price and stock.">
      <p className="visuallyHidden" aria-live="polite">{announcement}</p>
      {options.length === 0 ? <p className={styles.valuesHint}>This product has one variant. Add an option if it comes in sizes, colours or other choices.</p> : null}
      {options.length > 0 ? (
        <ul className={styles.groupList}>
          {options.map((option, optionIndex) => {
            const problem = describeOptionGroupProblem(option, options);
            const quietProblem = option.values.length === 0 && option.pendingText.trim() === "" && option.name.trim() !== "";
            const serverError = fieldErrors[`options.${optionIndex}.values`];
            return (
              <li key={option.key} className={styles.group}>
                <div className={styles.groupHeader}>
                  <TextField
                    label={`Option ${optionIndex + 1} name`}
                    placeholder="e.g. Size"
                    value={option.name}
                    maxLength={productOptionLimits.maxNameBytes}
                    autoFocus={focusKey === option.key && option.name === ""}
                    onChange={(event) => updateOption(option.key, { name: event.target.value })}
                    errorMessage={fieldErrors[`options.${optionIndex}.name`]}
                  />
                  <IconButton iconName="trash24" label={`Remove ${option.name.trim() || `option ${optionIndex + 1}`}`} onClick={() => void removeOption(option)} />
                </div>
                {option.name.trim() === "" && suggestions.length > 0 ? (
                  <div className={styles.nameSuggestions} role="group" aria-label="Suggested names">
                    {suggestions.map((name) => <Button key={name} size="small" variant="ghost" onClick={() => updateOption(option.key, { name })}>{name}</Button>)}
                  </div>
                ) : null}
                <OptionValuesInput
                  optionName={option.name}
                  values={option.values}
                  pendingText={option.pendingText}
                  autoFocus={focusKey === option.key && option.name !== ""}
                  errorMessage={serverError}
                  onChange={(patch) => updateOption(option.key, patch)}
                  onRemoveValue={(value) => void removeValue(option, value)}
                  onAnnounce={announce}
                />
                {problem && !quietProblem && problem !== serverError ? <p className={styles.groupError}>{problem}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {canAddOption ? (
        <div className={styles.addOptionRow} style={{ marginTop: options.length > 0 ? "var(--space-3)" : "var(--space-2)" }}>
          <span className={styles.addOptionLabel}>{options.length === 0 ? "Add option" : "Add another option"}</span>
          {suggestions.map((name) => <Button key={name} size="small" iconName="plus16" onClick={() => addOption(name)}>{name}</Button>)}
          <Button size="small" variant="ghost" iconName="plus16" onClick={() => addOption("")}>Custom</Button>
        </div>
      ) : options.length >= productOptionLimits.maxGroups ? (
        <p className={styles.footerNote}>A product can have up to {productOptionLimits.maxGroups} options.</p>
      ) : null}
      {combinations > productOptionLimits.maxVariants ? (
        <p className={styles.groupError} role="alert">These options make {combinations} variants. The limit is {productOptionLimits.maxVariants}, so remove a few values.</p>
      ) : null}
      {blockedMessage ? <p className={styles.groupError} role="alert">{blockedMessage}</p> : null}
      {fieldErrors.options ? <p className={styles.groupError} role="alert">{fieldErrors.options}</p> : null}
    </Panel>
  );
}
