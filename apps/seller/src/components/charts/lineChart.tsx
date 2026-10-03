"use client";

import { useId, useState } from "react";

import type { ChartSeries } from "@/components/charts/stackedBarChart";
import { calculateNiceAxisMaximum, listAxisTickValues } from "@/utils/chartScale.util";

import styles from "./charts.module.css";

export interface LineChartPoint {
  readonly label: string;
  readonly shortLabel: string;
  readonly values: Record<string, number>;
}

interface LineChartProps {
  readonly title: string;
  readonly description: string;
  readonly series: readonly ChartSeries[];
  readonly points: readonly LineChartPoint[];
  readonly formatValue: (value: number) => string;
  readonly formatAxisValue: (value: number) => string;
  readonly height?: number;
  readonly fillFirstSeries?: boolean;
}

const chartWidth = 720;
const plotPadding = { top: 12, right: 12, bottom: 26, left: 64 };

export function LineChart({ title, description, series, points, formatValue, formatAxisValue, height = 240, fillFirstSeries = true }: LineChartProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const plotWidth = chartWidth - plotPadding.left - plotPadding.right;
  const plotHeight = height - plotPadding.top - plotPadding.bottom;
  const largestValue = Math.max(0, ...points.flatMap((point) => series.map((entry) => point.values[entry.key] ?? 0)));
  const { axisMaximum, tickStep } = calculateNiceAxisMaximum(largestValue, 4);
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const readX = (pointIndex: number) => plotPadding.left + (points.length > 1 ? pointIndex * stepX : plotWidth / 2);
  const readY = (value: number) => plotPadding.top + plotHeight - (value / axisMaximum) * plotHeight;
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const bandWidth = points.length > 1 ? stepX : plotWidth;

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
          {listAxisTickValues(axisMaximum, tickStep).map((tick) => (
            <g key={tick} aria-hidden="true">
              <line x1={plotPadding.left} x2={chartWidth - plotPadding.right} y1={readY(tick)} y2={readY(tick)} className={tick === 0 ? styles.baseline : styles.gridline} />
              <text x={plotPadding.left - 8} y={readY(tick) + 4} textAnchor="end" className={styles.axisText}>
                {formatAxisValue(tick)}
              </text>
            </g>
          ))}
          {series.map((entry, seriesIndex) => {
            const linePath = points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${readX(pointIndex).toFixed(1)},${readY(point.values[entry.key] ?? 0).toFixed(1)}`).join(" ");
            const areaPath = points.length > 0 ? `${linePath} L${readX(points.length - 1).toFixed(1)},${readY(0)} L${readX(0).toFixed(1)},${readY(0)} Z` : "";
            return (
              <g key={entry.key} aria-hidden="true">
                {fillFirstSeries && seriesIndex === 0 ? <path d={areaPath} style={{ fill: `var(${entry.colorVariable})`, opacity: 0.12 }} /> : null}
                <path d={linePath} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: `var(${entry.colorVariable})` }} />
              </g>
            );
          })}
          {points.map((point, pointIndex) => (
            <g
              key={point.label}
              tabIndex={0}
              role="img"
              aria-label={`${point.label}: ${series.map((entry) => `${entry.label} ${formatValue(point.values[entry.key] ?? 0)}`).join(", ")}`}
              className={styles.barGroup}
              onMouseEnter={() => setActiveIndex(pointIndex)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(pointIndex)}
              onBlur={() => setActiveIndex(null)}
            >
              <rect x={readX(pointIndex) - bandWidth / 2} y={plotPadding.top} width={bandWidth} height={plotHeight} className={styles.transparentBand} />
              {activeIndex === pointIndex ? <line x1={readX(pointIndex)} x2={readX(pointIndex)} y1={plotPadding.top} y2={plotPadding.top + plotHeight} className={styles.gridline} /> : null}
              {activeIndex === pointIndex
                ? series.map((entry) => <circle key={entry.key} cx={readX(pointIndex)} cy={readY(point.values[entry.key] ?? 0)} r={4} style={{ fill: `var(${entry.colorVariable})` }} />)
                : null}
              {pointIndex % labelEvery === 0 ? (
                <text x={readX(pointIndex)} y={height - 8} textAnchor="middle" className={styles.axisText} aria-hidden="true">
                  {point.shortLabel}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
        {activePoint && activeIndex !== null ? (
          <div className={styles.tooltip} style={{ left: `${Math.min(85, Math.max(15, (readX(activeIndex) / chartWidth) * 100))}%` }} aria-hidden="true">
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
            <th scope="col">Period</th>
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
