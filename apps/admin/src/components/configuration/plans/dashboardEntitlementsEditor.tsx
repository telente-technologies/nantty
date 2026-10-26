import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import type { DashboardEntitlement } from "@/types/platformConfiguration.type";

import styles from "./plansEditor.module.css";

export function DashboardEntitlementsEditor({ entitlements, canWrite, onChange }: { readonly entitlements: readonly DashboardEntitlement[]; readonly canWrite: boolean; readonly onChange: (entitlements: DashboardEntitlement[]) => void }) {
  function updateEntitlementAt(index: number, changes: Partial<DashboardEntitlement>) {
    onChange(entitlements.map((entitlement, candidateIndex) => (candidateIndex === index ? { ...entitlement, ...changes } : entitlement)));
  }
  return (
    <fieldset className={styles.entitlements}>
      <legend>Nantty Dashboard entitlements</legend>
      <p className={styles.planNote}>Gold subscribers get access to creator.nantty.com with these limits. Leave the limit empty for unlimited.</p>
      {entitlements.map((entitlement, index) => (
        <div key={index} className={styles.entitlementRow}>
          <TextField label="Key" value={entitlement.key} disabled={!canWrite} onChange={(event) => updateEntitlementAt(index, { key: event.target.value.replace(/[^A-Za-z0-9]/g, "") })} />
          <TextField label="What it unlocks" value={entitlement.label} disabled={!canWrite} onChange={(event) => updateEntitlementAt(index, { label: event.target.value })} />
          <TextField label="Limit" type="number" min={0} value={entitlement.limit === null ? "" : String(entitlement.limit)} placeholder="Unlimited" disabled={!canWrite} onChange={(event) => updateEntitlementAt(index, { limit: event.target.value === "" ? null : Math.max(0, Math.round(Number(event.target.value))) })} />
          {canWrite ? <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${entitlement.label}`} onClick={() => onChange(entitlements.filter((_, candidateIndex) => candidateIndex !== index))} /> : null}
        </div>
      ))}
      {canWrite ? (
        <Button size="small" iconName="plus16" onClick={() => onChange([...entitlements, { key: "newEntitlement", label: "New entitlement", limit: null }])}>
          Add entitlement
        </Button>
      ) : null}
    </fieldset>
  );
}
