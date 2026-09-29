import styles from "./horizontalBarChart.module.css";

export interface HorizontalBar {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly formattedValue: string;
  readonly comparisonValue?: number | null;
  readonly formattedComparisonValue?: string;
}

interface HorizontalBarChartProps {
  readonly title: string;
  readonly metricLabel: string;
  readonly bars: readonly HorizontalBar[];
  readonly maximumBars?: number;
  readonly comparisonLabel?: string;
}

export function HorizontalBarChart({ title, metricLabel, bars, maximumBars = 10, comparisonLabel }: HorizontalBarChartProps) {
  const sortedBars = [...bars].sort((first, second) => second.value - first.value);
  const visibleBars = sortedBars.slice(0, maximumBars);
  const hiddenCount = sortedBars.length - visibleBars.length;
  const maximumValue = Math.max(...visibleBars.map((bar) => Math.max(bar.value, bar.comparisonValue ?? 0)), 0) || 1;
  const hasComparison = visibleBars.some((bar) => bar.comparisonValue !== undefined && bar.comparisonValue !== null);
  return (
    <figure className={styles.figure}>
      <figcaption className="visuallyHidden">
        {title}: {metricLabel}
      </figcaption>
      {hasComparison ? (
        <div className={styles.legend} aria-hidden>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} />
            {metricLabel}
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.legendSwatchCompare}`} />
            {comparisonLabel}
          </span>
        </div>
      ) : null}
      <ul className={styles.list}>
        {visibleBars.map((bar) => (
          <li key={bar.key} className={styles.row} title={`${bar.label}: ${bar.formattedValue}${hasComparison ? ` (${comparisonLabel}: ${bar.formattedComparisonValue ?? "—"})` : ""}`}>
            <span className={styles.label}>{bar.label}</span>
            <span className={styles.track} aria-hidden>
              <span className={styles.bar} style={{ width: `${Math.max((bar.value / maximumValue) * 100, bar.value > 0 ? 1 : 0)}%` }} />
              {hasComparison ? <span className={styles.comparisonBar} style={{ width: `${Math.max(((bar.comparisonValue ?? 0) / maximumValue) * 100, 0)}%` }} /> : null}
            </span>
            <span className={styles.value}>
              {bar.formattedValue}
              {hasComparison ? <span className="visuallyHidden">, {comparisonLabel} {bar.formattedComparisonValue ?? "—"}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? <p className={styles.more}>+{hiddenCount} more in the table below</p> : null}
    </figure>
  );
}
