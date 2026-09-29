"use client";

import { SelectField, TextField } from "@/components/ui/formFields";

import { deliveryRangePresetOptions, type DeliveryRangePreset, type DeliveryRangeSelection } from "./deliveryRange.util";
import styles from "./deliveryRangeControl.module.css";

export function DeliveryRangeControl({ selection, onSelectionChange }: { readonly selection: DeliveryRangeSelection; readonly onSelectionChange: (selection: DeliveryRangeSelection) => void }) {
  return (
    <div className={styles.control}>
      <SelectField<DeliveryRangePreset>
        label="Date range"
        value={selection.preset}
        options={deliveryRangePresetOptions}
        onValueChange={(preset) => onSelectionChange({ ...selection, preset })}
        fieldClassName={styles.presetField}
      />
      {selection.preset === "custom" ? (
        <>
          <TextField label="From" type="date" value={selection.customFrom} max={selection.customTo || undefined} onValueChange={(customFrom) => onSelectionChange({ ...selection, customFrom })} fieldClassName={styles.dateField} />
          <TextField label="To" type="date" value={selection.customTo} min={selection.customFrom || undefined} onValueChange={(customTo) => onSelectionChange({ ...selection, customTo })} fieldClassName={styles.dateField} />
        </>
      ) : null}
    </div>
  );
}
