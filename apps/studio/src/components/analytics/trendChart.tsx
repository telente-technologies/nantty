"use client";

import { useId, useState } from "react";

import type { Bucket } from "@/utils/analyticsBuckets.util";

import styles from "./analytics.module.css";

interface TrendChartProps {
  readonly title: string;
  readonly total: string;
  readonly buckets: readonly Bucket[];
  readonly formatValue: (value: number) => string;
  readonly emptyHint: string;
}

const WIDTH = 600;
const HEIGHT = 160;
const GAP = 2;

export function TrendChart({ title, total, buckets, formatValue, emptyHint }: TrendChartProps) {
  const headingId = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...buckets.map((bucket) => bucket.value));
  const barWidth = buckets.length > 0 ? WIDTH / buckets.length : WIDTH;
  const focused = active === null ? null : buckets[active];
  const labelIndexes = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1]);

  return (
    <section className={styles.chartCard} aria-labelledby={headingId}>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle} id={headingId}>{title}</h2>
        <strong className={styles.chartTotal}>{total}</strong>
      </div>
      <p className={styles.readout} aria-live="polite">
        {focused ? `${focused.label}: ${formatValue(focused.value)}` : max === 0 ? emptyHint : `Peak ${formatValue(max)}`}
      </p>
      <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${title}, ${buckets.length} periods, total ${total}`} onMouseLeave={() => setActive(null)}>
        <line x1={0} x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} className={styles.baseline} />
        {buckets.map((bucket, index) => {
          const height = max === 0 ? 0 : Math.max(bucket.value > 0 ? 3 : 0, (bucket.value / max) * (HEIGHT - 8));
          const x = index * barWidth + GAP / 2;
          return (
            <g key={bucket.key} onMouseEnter={() => setActive(index)}>
              <rect x={index * barWidth} y={0} width={barWidth} height={HEIGHT} className={styles.hitArea} />
              {height > 0 ? <rect x={x} y={HEIGHT - height} width={Math.max(1, barWidth - GAP)} height={height} rx={Math.min(4, barWidth / 4)} className={active === index ? `${styles.bar} ${styles.barActive}` : styles.bar} /> : null}
              <title>{`${bucket.label}: ${formatValue(bucket.value)}`}</title>
            </g>
          );
        })}
      </svg>
      <div className={styles.axis} aria-hidden="true">
        {[...labelIndexes].map((index) => <span key={index}>{buckets[index]?.label ?? ""}</span>)}
      </div>
      <details className={styles.tableToggle}>
        <summary>Show as table</summary>
        <table className={styles.table}>
          <caption className="visuallyHidden">{title}</caption>
          <thead><tr><th scope="col">Period</th><th scope="col">Value</th></tr></thead>
          <tbody>
            {buckets.map((bucket) => <tr key={bucket.key}><th scope="row">{bucket.label}</th><td>{formatValue(bucket.value)}</td></tr>)}
          </tbody>
        </table>
      </details>
    </section>
  );
}
