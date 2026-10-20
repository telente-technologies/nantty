"use client";

import type { ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { MoneyField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import type { CurrencyCode } from "@/types/money.type";

import styles from "./productEditor.module.css";

interface ProductShippingSectionProps {
  readonly draft: ProductDraft;
  readonly fieldErrors: Record<string, string>;
  readonly currency: CurrencyCode;
  readonly onDraftChange: (patch: Partial<ProductDraft>) => void;
}

function wholeNumberText(value: string): string {
  return value.replace(/\D/g, "");
}

export function ProductShippingSection({ draft, fieldErrors, currency, onDraftChange }: ProductShippingSectionProps) {
  return (
    <Panel title="Shipping and packaging" description="Used to price and arrange delivery. Variants inherit these values, and buyers do not see them.">
      <div className={styles.formGrid}>
        <TextField
          label="Weight (grams)"
          inputMode="numeric"
          value={draft.weightGramsText}
          maxLength={7}
          onChange={(event) => onDraftChange({ weightGramsText: wholeNumberText(event.target.value) })}
          errorMessage={fieldErrors.weightGrams}
          hint="Leave blank if you do not know it yet."
        />
        <TextField
          label="Packages"
          inputMode="numeric"
          value={draft.packageCountText}
          maxLength={4}
          onChange={(event) => onDraftChange({ packageCountText: wholeNumberText(event.target.value) })}
          errorMessage={fieldErrors.packageCount}
          hint="How many boxes or parcels make up one order of this product."
        />
        <div className={`${styles.dimensionGrid} ${styles.fullRow}`}>
          <TextField
            label="Length (mm)"
            inputMode="numeric"
            value={draft.lengthMmText}
            maxLength={5}
            onChange={(event) => onDraftChange({ lengthMmText: wholeNumberText(event.target.value) })}
            errorMessage={fieldErrors.lengthMm}
          />
          <TextField
            label="Width (mm)"
            inputMode="numeric"
            value={draft.widthMmText}
            maxLength={5}
            onChange={(event) => onDraftChange({ widthMmText: wholeNumberText(event.target.value) })}
            errorMessage={fieldErrors.widthMm}
          />
          <TextField
            label="Height (mm)"
            inputMode="numeric"
            value={draft.heightMmText}
            maxLength={5}
            onChange={(event) => onDraftChange({ heightMmText: wholeNumberText(event.target.value) })}
            errorMessage={fieldErrors.heightMm}
          />
        </div>
        <TextField
          label="Package type"
          value={draft.packageCategory}
          maxLength={40}
          onChange={(event) => onDraftChange({ packageCategory: event.target.value })}
          errorMessage={fieldErrors.packageCategory}
          hint="For example apparel, electronics or homeware."
        />
        <MoneyField
          label="Declared value"
          currency={currency}
          valueText={draft.declaredValueText}
          onValueTextChange={(declaredValueText) => onDraftChange({ declaredValueText })}
          errorMessage={fieldErrors.declaredValueMinor}
          hint="Used for cover if a parcel is lost or damaged."
        />
        <TextField
          className={styles.fullRow}
          label="Package contents"
          value={draft.contentsDescription}
          maxLength={300}
          onChange={(event) => onDraftChange({ contentsDescription: event.target.value })}
          errorMessage={fieldErrors.contentsDescription}
          hint="For example two folded shirts. This is not shown to buyers."
        />
      </div>
      <div className={styles.toggleList}>
        <ToggleSwitch label="Fragile" description="Marks the parcel as fragile when a courier is arranged." checked={draft.fragile} onCheckedChange={(fragile) => onDraftChange({ fragile })} />
      </div>
    </Panel>
  );
}
