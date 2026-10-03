"use client";

import { useId } from "react";

import styles from "./settings.module.css";

export function ConsentToggleRow({ label, description, enabled, disabled, onChange }: { readonly label: string; readonly description: string; readonly enabled: boolean; readonly disabled?: boolean; readonly onChange: (enabled: boolean) => void }) {
  const labelId = useId();
  return (
    <div className={styles.toggleRow}>
      <div>
        <p id={labelId} className={styles.toggleLabel}>{label}</p>
        <p className={styles.muted}>{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-labelledby={labelId} disabled={disabled} className={styles.switch} onClick={() => onChange(!enabled)}>
        <span className={styles.switchThumb} />
      </button>
    </div>
  );
}
