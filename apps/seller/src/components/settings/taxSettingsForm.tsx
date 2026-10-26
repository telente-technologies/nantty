"use client";

import { useState } from "react";

import { SettingsFormFrame, StoreSettingsLoadedGate, useCanEditStoreSettings } from "@/components/settings/settingsFormFrame";
import { Button, IconButton } from "@/components/ui/button";
import { CheckboxField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { ProductCategory } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";
import type { StoreSettings, TaxRate } from "@/types/store.type";
import { convertBasisPointsToPercentText, convertPercentTextToBasisPoints } from "@/utils/settingsPercent.util";

import styles from "./settings.module.css";

interface TaxRateDraft {
  readonly id: string;
  readonly name: string;
  readonly percentText: string;
  readonly isDefault: boolean;
  readonly appliesToCategoryIds: string[] | null;
}

function convertTaxRateToDraft(taxRate: TaxRate): TaxRateDraft {
  return { id: taxRate.id, name: taxRate.name, percentText: convertBasisPointsToPercentText(taxRate.rateBasisPoints), isDefault: taxRate.isDefault, appliesToCategoryIds: taxRate.appliesToCategoryIds };
}

function validateTaxRateDrafts(drafts: readonly TaxRateDraft[]): string[] {
  const messages: string[] = [];
  drafts.forEach((draft, index) => {
    const label = draft.name.trim() || `Rate ${index + 1}`;
    if (!draft.name.trim() || draft.name.trim().length > 40) messages.push(`${label}: give it a name of up to 40 characters.`);
    if (convertPercentTextToBasisPoints(draft.percentText) === null) messages.push(`${label}: enter a rate between 0 and 100 with up to 2 decimals.`);
    if (!draft.isDefault && (!draft.appliesToCategoryIds || draft.appliesToCategoryIds.length === 0)) messages.push(`${label}: pick the categories it applies to.`);
  });
  if (drafts.length > 0 && drafts.filter((draft) => draft.isDefault).length !== 1) messages.push("Mark exactly one rate as the default.");
  return messages;
}

function TaxRatesForm({ settings }: { readonly settings: StoreSettings }) {
  const canEdit = useCanEditStoreSettings();
  const categoriesQuery = useSellerQuery<CursorPage<ProductCategory>>("/seller/categories");
  const categories = categoriesQuery.data?.data ?? [];
  const [drafts, setDrafts] = useState<TaxRateDraft[]>(settings.taxes.map(convertTaxRateToDraft));
  const [pricesIncludeTax, setPricesIncludeTax] = useState(settings.pricesIncludeTax);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();

  function updateDraft(index: number, changes: Partial<TaxRateDraft>) {
    setDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...changes } : draft)));
  }

  function markDraftAsDefault(index: number) {
    setDrafts((current) => current.map((draft, draftIndex) => ({ ...draft, isDefault: draftIndex === index, appliesToCategoryIds: draftIndex === index ? null : draft.appliesToCategoryIds ?? [] })));
  }

  function toggleCategoryForDraft(index: number, categoryId: string, isChecked: boolean) {
    const currentIds = drafts[index]?.appliesToCategoryIds ?? [];
    updateDraft(index, { appliesToCategoryIds: isChecked ? [...currentIds, categoryId] : currentIds.filter((id) => id !== categoryId) });
  }

  async function saveTaxSettings() {
    const messages = validateTaxRateDrafts(drafts);
    setErrorMessages(messages);
    if (messages.length > 0) return;
    const taxes: TaxRate[] = drafts.map((draft) => ({ id: draft.id, name: draft.name.trim(), rateBasisPoints: convertPercentTextToBasisPoints(draft.percentText) ?? 0, isDefault: draft.isDefault, appliesToCategoryIds: draft.isDefault ? null : draft.appliesToCategoryIds }));
    await saveStoreSettingsPatch({ taxes, pricesIncludeTax }, "Tax settings saved.");
  }

  return (
    <SettingsFormFrame title="Taxes" description="Rates added to orders in the Nantty app. Category rates override the default." errorMessages={[...errorMessages, ...Object.values(serverFieldErrors)]} isSaving={isSaving} onSubmit={() => void saveTaxSettings()}>
      <ToggleSwitch
        label="My prices already include tax"
        description={pricesIncludeTax ? "Shelf prices are final. Receipts show the tax that is inside each price." : "Tax is added on top of shelf prices at checkout."}
        checked={pricesIncludeTax}
        onCheckedChange={setPricesIncludeTax}
        disabled={!canEdit}
      />
      <ul className={styles.listReset}>
        {drafts.map((draft, index) => (
          <li key={draft.id} className={styles.rowCard}>
            <div className={styles.rowHeader}>
              <span className={styles.rowTitle}>
                {draft.name || "New rate"} {draft.isDefault ? <StatusBadge tone="info">Default</StatusBadge> : null}
              </span>
              <div className={styles.inlineActions}>
                {!draft.isDefault ? <Button size="small" onClick={() => markDraftAsDefault(index)}>Make default</Button> : null}
                <IconButton iconName="trash24" label={`Remove ${draft.name || "rate"}`} size="small" onClick={() => setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))} />
              </div>
            </div>
            <div className={styles.twoColumns}>
              <TextField label="Name" value={draft.name} maxLength={40} onChange={(event) => updateDraft(index, { name: event.target.value })} />
              <TextField label="Rate (%)" inputMode="decimal" value={draft.percentText} maxLength={6} onChange={(event) => updateDraft(index, { percentText: event.target.value })} />
            </div>
            {draft.isDefault ? (
              <p className={styles.mutedText}>Applies to every taxable product without a category rate.</p>
            ) : (
              <div>
                <p className={styles.readOnlyLabel}>Applies to categories</p>
                <div className={styles.categoryChecklist}>
                  {categories.map((category) => (
                    <CheckboxField key={category.id} label={category.name} checked={draft.appliesToCategoryIds?.includes(category.id) ?? false} onCheckedChange={(isChecked) => toggleCategoryForDraft(index, category.id, isChecked)} />
                  ))}
                  {categoriesQuery.errorMessage ? <span className={styles.mutedText}>{categoriesQuery.errorMessage}</span> : null}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div>
        <Button iconName="plus16" onClick={() => setDrafts((current) => [...current, { id: `tax_${crypto.randomUUID().slice(0, 8)}`, name: "", percentText: "", isDefault: current.length === 0, appliesToCategoryIds: current.length === 0 ? null : [] }])}>
          Add tax rate
        </Button>
      </div>
    </SettingsFormFrame>
  );
}

export function TaxSettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <TaxRatesForm key={JSON.stringify(settings.taxes) + settings.pricesIncludeTax} settings={settings} />}</StoreSettingsLoadedGate>;
}
