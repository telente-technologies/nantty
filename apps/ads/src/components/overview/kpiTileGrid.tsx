import { MetricDeltaText } from "@/components/reports/metricDeltaText";
import type { MetricDelta } from "@/components/reports/reportChartData.util";

import styles from "./kpiTileGrid.module.css";

export interface KpiTile {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly delta: MetricDelta | null;
  readonly hint?: string;
}

export function KpiTileGrid({ tiles, isLoading }: { readonly tiles: readonly KpiTile[]; readonly isLoading: boolean }) {
  return (
    <ul className={styles.grid} aria-busy={isLoading || undefined}>
      {tiles.map((tile) => (
        <li key={tile.key} className={styles.tile}>
          <span className={styles.label}>{tile.label}</span>
          <span className={styles.value}>{isLoading ? "…" : tile.value}</span>
          <span className={styles.footer}>{isLoading ? null : tile.delta ? <MetricDeltaText delta={tile.delta} /> : tile.hint ? <span className={styles.hint}>{tile.hint}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}
