import type { MetricDelta } from "@/components/reports/reportChartData.util";

import styles from "./metricDeltaText.module.css";

export function MetricDeltaText({ delta, comparisonLabel = "vs previous period" }: { readonly delta: MetricDelta | null; readonly comparisonLabel?: string }) {
  if (!delta) return null;
  const arrow = delta.change === null || delta.tone === "neutral" ? "" : delta.change > 0 ? "↑ " : "↓ ";
  const meaning = delta.tone === "better" ? "better" : delta.tone === "worse" ? "worse" : "unchanged";
  return (
    <span className={`${styles.delta} ${styles[delta.tone]}`}>
      <span aria-hidden>{arrow}</span>
      {delta.label}
      <span className="visuallyHidden">
        {" "}
        {comparisonLabel}, {meaning}
      </span>
    </span>
  );
}
