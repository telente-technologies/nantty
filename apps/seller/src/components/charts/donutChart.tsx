import { useId } from "react";

import styles from "./charts.module.css";

export interface DonutSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly displayValue: string;
  readonly colorVariable: string;
}

export function DonutChart({ title, segments, centerLabel, centerValue }: { readonly title: string; readonly segments: readonly DonutSegment[]; readonly centerLabel: string; readonly centerValue: string }) {
  const titleId = useId();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let consumedLength = 0;
  return (
    <figure className={styles.donutFigure}>
      <svg viewBox="0 0 120 120" className={styles.donutSvg} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`${title}: ${segments.map((segment) => `${segment.label} ${segment.displayValue}`).join(", ")}`}</title>
        <circle cx="60" cy="60" r={radius} className={styles.donutTrack} />
        {total > 0
          ? segments.map((segment) => {
              const segmentLength = (segment.value / total) * circumference;
              const circle = (
                <circle
                  key={segment.key}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  strokeWidth="14"
                  style={{ stroke: `var(${segment.colorVariable})` }}
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={-consumedLength}
                  transform="rotate(-90 60 60)"
                />
              );
              consumedLength += segmentLength;
              return circle;
            })
          : null}
        <text x="60" y="56" textAnchor="middle" className={styles.donutCenterLabel}>
          {centerLabel}
        </text>
        <text x="60" y="72" textAnchor="middle" className={styles.donutCenterValue}>
          {centerValue}
        </text>
      </svg>
      <ul className={styles.donutLegend}>
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className={styles.legendSwatch} style={{ background: `var(${segment.colorVariable})` }} />
            <span className={styles.donutLegendLabel}>{segment.label}</span>
            <span className={styles.donutLegendValue}>{segment.displayValue}</span>
            <span className={styles.donutLegendShare}>{total > 0 ? `${Math.round((segment.value / total) * 100)}%` : "0%"}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
