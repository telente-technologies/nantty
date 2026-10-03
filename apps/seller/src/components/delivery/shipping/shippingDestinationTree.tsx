"use client";

import { nigeriaCountry, nigeriaGeoStates } from "@/constants/nigeriaGeo.constant";
import { allShippingLeafKeys, readLeafKeysOfState } from "@/utils/shippingDestinationSelection.util";

import styles from "./shipping.module.css";

function TriStateCheckbox({ label, selectedCount, totalCount, onToggle, disabled }: { readonly label: string; readonly selectedCount: number; readonly totalCount: number; readonly onToggle: () => void; readonly disabled?: boolean }) {
  const isAll = totalCount > 0 && selectedCount === totalCount;
  return (
    <label className={styles.treeCheckbox}>
      <input type="checkbox" checked={isAll} disabled={disabled} ref={(element) => { if (element) element.indeterminate = selectedCount > 0 && !isAll; }} onChange={onToggle} />
      <span>{label}</span>
      {selectedCount > 0 ? <span className={styles.muted}>{isAll ? "all" : `${selectedCount}/${totalCount}`}</span> : null}
    </label>
  );
}

export function ShippingDestinationTree({ selectedLeafKeys, onChange, disabled }: { readonly selectedLeafKeys: ReadonlySet<string>; readonly onChange: (next: Set<string>) => void; readonly disabled?: boolean }) {
  function toggleKeys(keys: readonly string[]) {
    const next = new Set(selectedLeafKeys);
    const everyKeySelected = keys.every((key) => next.has(key));
    keys.forEach((key) => (everyKeySelected ? next.delete(key) : next.add(key)));
    onChange(next);
  }
  const countSelected = (keys: readonly string[]) => keys.filter((key) => selectedLeafKeys.has(key)).length;

  return (
    <div className={styles.tree} role="group" aria-label="Destinations">
      <TriStateCheckbox label={`${nigeriaCountry.name} (all states)`} selectedCount={countSelected(allShippingLeafKeys)} totalCount={allShippingLeafKeys.length} onToggle={() => toggleKeys(allShippingLeafKeys)} disabled={disabled} />
      <ul className={styles.treeLevel}>
        {nigeriaGeoStates.map((geoState) => {
          const leafKeys = readLeafKeysOfState(geoState);
          const hasLocalGovernmentAreas = geoState.localGovernmentAreas.length > 0;
          const stateCheckbox = <TriStateCheckbox label={geoState.name} selectedCount={countSelected(leafKeys)} totalCount={leafKeys.length} onToggle={() => toggleKeys(leafKeys)} disabled={disabled} />;
          if (!hasLocalGovernmentAreas) return <li key={geoState.code} className={styles.treeLeafRow}>{stateCheckbox}</li>;
          return (
            <li key={geoState.code}>
              <details className={styles.treeDetails}>
                <summary>{stateCheckbox}</summary>
                <ul className={styles.treeLevel}>
                  {geoState.localGovernmentAreas.map((lgaName, index) => {
                    const leafKey = leafKeys[index] as string;
                    return (
                      <li key={leafKey} className={styles.treeLeafRow}>
                        <TriStateCheckbox label={lgaName} selectedCount={selectedLeafKeys.has(leafKey) ? 1 : 0} totalCount={1} onToggle={() => toggleKeys([leafKey])} disabled={disabled} />
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
