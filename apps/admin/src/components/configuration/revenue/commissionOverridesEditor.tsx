import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import type { CategoryCommissionOverride } from "@/types/platformConfiguration.type";

import { BasisPointsField } from "../shared/configurationFields";
import styles from "./revenueRules.module.css";

export function CommissionOverridesEditor({ overrides, canWrite, onChange }: { readonly overrides: readonly CategoryCommissionOverride[]; readonly canWrite: boolean; readonly onChange: (overrides: CategoryCommissionOverride[]) => void }) {
  function updateOverrideAt(index: number, changes: Partial<CategoryCommissionOverride>) {
    onChange(overrides.map((override, candidateIndex) => (candidateIndex === index ? { ...override, ...changes } : override)));
  }
  return (
    <fieldset className={styles.overrides}>
      <legend>Category overrides</legend>
      {overrides.length === 0 ? <p className={styles.note}>Every category uses the default commission.</p> : null}
      {overrides.map((override, index) => (
        <div key={index} className={styles.overrideRow}>
          <TextField label="Category name" value={override.categoryName} disabled={!canWrite} onChange={(event) => updateOverrideAt(index, { categoryName: event.target.value })} />
          <TextField label="Category slug" value={override.categorySlug} disabled={!canWrite} onChange={(event) => updateOverrideAt(index, { categorySlug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          <BasisPointsField label="Commission" basisPoints={override.basisPoints} maximumBasisPoints={3000} isDisabled={!canWrite} onChange={(basisPoints) => updateOverrideAt(index, { basisPoints })} />
          {canWrite ? <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${override.categoryName}`} onClick={() => onChange(overrides.filter((_, candidateIndex) => candidateIndex !== index))} /> : null}
        </div>
      ))}
      {canWrite ? (
        <Button size="small" iconName="plus16" onClick={() => onChange([...overrides, { categoryName: "New category", categorySlug: "new-category", basisPoints: 750 }])}>
          Add override
        </Button>
      ) : null}
    </fieldset>
  );
}
