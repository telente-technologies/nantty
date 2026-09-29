"use client";

import { useId, useState } from "react";

import { calculateNiceAxisMaximum, listAxisTickValues } from "@/utils/chartScale.util";

import styles from "./charts.module.css";

export interface ChartSeries {
  readonly key: string;
  readonly label: string;
  readonly colorVariable: string;
}

export interface StackedBarPoint {
  readonly label: string;
  readonly shortLabel: string;
  readonly values: Record<string, number>;
}

interface StackedBarChartProps {
  readonly title: string;
  readonly description: string;
  readonly series: readonly ChartSeries[];
  readonly points: readonly StackedBarPoint[];
  readonly formatValue: (value: number) => string;
  readonly formatAxisValue: (value: number) => string;
  readonly height?: number;
}

const chartWidth = 720;
const plotPadding = { top: 12, right: 8, bottom: 26, left: 64 };

export function StackedBarChart({ title, description, series, points, formatValue, formatAxisValue, height = 240 }: StackedBarChartProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const plotWidth = chartWidth - plotPadding.left - plotPadding.right;
  const plotHeight = height - plotPadding.top - plotPadding.bottom;
  const pointTotals = points.map((point) => series.reduce((sum, entry) => sum + (point.values[entry.key] ?? 0), 0));
  const { axisMaximum, tickStep } = calculateNiceAxisMaximum(Math.max(0, ...pointTotals), 4);
  const slotWidth = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(2, Math.min(28, slotWidth * 0.64));
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const scaleValueToHeight = (value: number) => (value / axisMaximum) * plotHeight;
  const activePoint = activeIndex === null ? null : points[activeIndex];

  return (
    <figure className={styles.figure}>
      <div className={styles.legend} aria-hidden="true">
        {series.map((entry) => (
          <span key={entry.key} className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: `var(${entry.colorVariable})` }} />
            {entry.label}
          </span>
        ))}
      </div>
      <div className={styles.plotArea}>
        <svg viewBox={`0 0 ${chartWidth} ${height}`} className={styles.svg} role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>{title}</title>
          <desc id={descriptionId}>{description}</desc>
          {listAxisTickValues(axisMaximum, tickStep).map((tick) => {
            const y = plotPadding.top + plotHeight - scaleValueToHeight(tick);
            return (
              <g key={tick} aria-hidden="true">
                <line x1={plotPadding.left} x2={chartWidth - plotPadding.right} y1={y} y2={y} className={tick === 0 ? styles.baseline : styles.gridline} />
                <text x={plotPadding.left - 8} y={y + 4} textAnchor="end" className={styles.axisText}>
                  {formatAxisValue(tick)}
                </text>
              </g>
            );
          })}
          {points.map((point, pointIndex) => {
            const x = plotPadding.left + pointIndex * slotWidth + (slotWidth - barWidth) / 2;
            let stackedHeight = 0;
            const summary = `${point.label}: ${series.map((entry) => `${entry.label} ${formatValue(point.values[entry.key] ?? 0)}`).join(", ")}`;
            return (
              <g
                key={point.label}
                tabIndex={0}
                role="img"
                aria-label={summary}
                className={styles.barGroup}
                onMouseEnter={() => setActiveIndex(pointIndex)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(pointIndex)}
                onBlur={() => setActiveIndex(null)}
              >
                <rect x={plotPadding.left + pointIndex * slotWidth} y={plotPadding.top} width={slotWidth} height={plotHeight} className={activeIndex === pointIndex ? styles.hoverBand : styles.transparentBand} />
                {series.map((entry) => {
                  const segmentHeight = scaleValueToHeight(point.values[entry.key] ?? 0);
                  stackedHeight += segmentHeight;
                  return segmentHeight > 0 ? <rect key={entry.key} x={x} y={plotPadding.top + plotHeight - stackedHeight} width={barWidth} height={segmentHeight} rx={Math.min(3, barWidth / 3)} style={{ fill: `var(${entry.colorVariable})` }} /> : null;
                })}
                {pointIndex % labelEvery === 0 ? (
                  <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className={styles.axisText} aria-hidden="true">
                    {point.shortLabel}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {activePoint && activeIndex !== null ? (
          <div className={styles.tooltip} style={{ left: `${((plotPadding.left + (activeIndex + 0.5) * slotWidth) / chartWidth) * 100}%` }} aria-hidden="true">
            <p className={styles.tooltipTitle}>{activePoint.label}</p>
            {series.map((entry) => (
              <p key={entry.key} className={styles.tooltipRow}>
                <span className={styles.legendSwatch} style={{ background: `var(${entry.colorVariable})` }} />
                {entry.label}
                <strong>{formatValue(activePoint.values[entry.key] ?? 0)}</strong>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <table className="visuallyHidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((entry) => (
              <th key={entry.key} scope="col">
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              {series.map((entry) => (
                <td key={entry.key}>{formatValue(point.values[entry.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
