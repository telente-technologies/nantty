"use client";

import { CheckboxField } from "@/components/ui/formFields";
import type { StoreLocation } from "@/types/store.type";

import styles from "./staff.module.css";

export function StaffLocationChecklist({ locations, selectedLocationIds, onChange, errorMessage }: { readonly locations: readonly StoreLocation[]; readonly selectedLocationIds: readonly string[]; readonly onChange: (locationIds: string[]) => void; readonly errorMessage?: string | null }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className={styles.sectionTitle}>Works at</legend>
      <div className={styles.checklist}>
        {locations.filter((location) => location.active).map((location) => (
          <CheckboxField
            key={location.id}
            label={location.name}
            checked={selectedLocationIds.includes(location.id)}
            onCheckedChange={(isChecked) => onChange(isChecked ? [...selectedLocationIds, location.id] : selectedLocationIds.filter((locationId) => locationId !== location.id))}
          />
        ))}
      </div>
      {errorMessage ? (
        <p role="alert" style={{ color: "var(--error-ink)", fontSize: 12, marginTop: 4 }}>
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  );
}
