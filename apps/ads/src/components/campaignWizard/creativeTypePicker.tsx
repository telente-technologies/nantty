"use client";

import { creativeTypeLabels } from "@/constants/campaignOptions.constant";
import type { CreativeType } from "@/types/creative.type";

import styles from "./richFormatEditor.module.css";

const typeOrder: readonly CreativeType[] = ["single", "carousel", "app_install", "promoted_post"];

interface CreativeTypePickerProps {
  readonly value: CreativeType;
  readonly onValueChange: (value: CreativeType) => void;
}

export function CreativeTypePicker({ value, onValueChange }: CreativeTypePickerProps) {
  return (
    <div>
      <p className={styles.cardTitle}>Ad type</p>
      <div role="radiogroup" aria-label="Ad type" className={styles.typeGrid}>
        {typeOrder.map((type) => (
          <button key={type} type="button" role="radio" aria-checked={value === type} className={value === type ? `${styles.typeOption} ${styles.typeOptionOn}` : styles.typeOption} onClick={() => onValueChange(type)}>
            <span className={styles.typeLabel}>{creativeTypeLabels[type].label}</span>
            <span className={styles.typeHint}>{creativeTypeLabels[type].description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
