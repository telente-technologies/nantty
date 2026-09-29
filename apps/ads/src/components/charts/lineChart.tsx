"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";

import { computeNiceAxisTicksFromZero, pickEvenlySpacedIndexes } from "@/components/charts/chartScale.util";
import { useMeasuredElementWidth } from "@/components/charts/useMeasuredWidth.hook";

import styles from "./lineChart.module.css";

export interface LineChartPoint {
  readonly label: string;
  readonly value: number;
  readonly formattedValue: string;
}

interface LineChartProps {
  readonly title: string;
  readonly description: string;
  readonly seriesLabel: string;
  readonly points: readonly LineChartPoint[];
  readonly comparisonLabel?: string;
  readonly comparisonPoints?: readonly LineChartPoint[];
  readonly formatAxisValue: (value: number) => string;
  readonly height?: number;
}

const padding = { top: 12, right: 12, bottom: 28, left: 56 };

function buildLinePath(values: readonly number[], toX: (index: number) => number, toY: (value: number) => number): string {
  return values.map((value, index) => `${index === 0 ? "M" : "L"}${toX(index).toFixed(1)},${toY(value).toFixed(1)}`).join(" ");
}

export function LineChart({ title, description, seriesLabel, points, comparisonLabel, comparisonPoints, formatAxisValue, height = 240 }: LineChartProps) {
  const { elementRef, width } = useMeasuredElementWidth<HTMLDivElement>(640);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasComparison = Boolean(comparisonPoints && comparisonPoints.length > 0);
  const plotWidth = Math.max(width - padding.left - padding.right, 40);
  const plotHeight = height - padding.top - padding.bottom;
  const maximumValue = Math.max(...points.map((point) => point.value), ...(comparisonPoints ?? []).map((point) => point.value), 0);
  const ticks = computeNiceAxisTicksFromZero(maximumValue);
  const axisMaximum = ticks[ticks.length - 1] || 1;
  const toX = (index: number) => padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const toY = (value: number) => padding.top + plotHeight - (value / axisMaximum) * plotHeight;
  const labelIndexes = pickEvenlySpacedIndexes(points.length, Math.max(2, Math.floor(plotWidth / 90)));
  const linePath = buildLinePath(points.map((point) => point.value), toX, toY);
  const areaPath = points.length > 0 ? `${linePath} L${toX(points.length - 1).toFixed(1)},${toY(0)} L${toX(0).toFixed(1)},${toY(0)} Z` : "";
  const comparisonValues = (comparisonPoints ?? []).slice(0, points.length).map((point) => point.value);
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const activeComparison = activeIndex === null ? null : comparisonPoints?.[activeIndex];

  function moveActivePointFromPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - bounds.left - padding.left;
    const index = Math.round((relativeX / plotWidth) * (points.length - 1));
    setActiveIndex(Math.min(Math.max(index, 0), points.length - 1));
  }

  function moveActivePointWithKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const current = activeIndex ?? 0;
    const nextIndex = event.key === "ArrowRight" ? current + 1 : event.key === "ArrowLeft" ? current - 1 : event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveIndex(Math.min(Math.max(nextIndex, 0), points.length - 1));
  }

  const tooltipLeft = activeIndex === null ? 0 : Math.min(Math.max(toX(activeIndex) - 90, 0), Math.max(width - 180, 0));

  return (
    <figure className={styles.figure}>
      <div className={styles.legend} aria-hidden>
        <span className={styles.legendItem}>
          <span className={styles.legendLine} />
          {seriesLabel}
        </span>
        {hasComparison ? (
          <span className={styles.legendItem}>
            <span className={`${styles.legendLine} ${styles.legendDashed}`} />
            {comparisonLabel}
          </span>
        ) : null}
      </div>
      <div ref={elementRef} className={styles.plotArea}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          tabIndex={0}
          className={styles.svg}
          onPointerMove={moveActivePointFromPointer}
          onPointerLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex((current) => current ?? points.length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={moveActivePointWithKeyboard}
        >
          <title id={titleId}>{title}</title>
          <desc id={descriptionId}>{description} Use the left and right arrow keys to read each day.</desc>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={padding.left} x2={padding.left + plotWidth} y1={toY(tick)} y2={toY(tick)} className={tick === 0 ? styles.baseline : styles.gridLine} />
              <text x={padding.left - 8} y={toY(tick)} dy="0.32em" textAnchor="end" className={styles.axisText}>
                {formatAxisValue(tick)}
              </text>
            </g>
          ))}
          {labelIndexes.map((index) => (
            <text key={index} x={toX(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className={styles.axisText}>
              {points[index]?.label}
            </text>
          ))}
          {areaPath ? <path d={areaPath} className={styles.area} /> : null}
          {comparisonValues.length > 1 ? <path d={buildLinePath(comparisonValues, toX, toY)} className={styles.comparisonLine} /> : null}
          {linePath ? <path d={linePath} className={styles.line} /> : null}
          {activeIndex !== null && activePoint ? (
            <g>
              <line x1={toX(activeIndex)} x2={toX(activeIndex)} y1={padding.top} y2={padding.top + plotHeight} className={styles.crosshair} />
              {activeComparison ? <circle cx={toX(activeIndex)} cy={toY(activeComparison.value)} r={4} className={styles.comparisonMarker} /> : null}
              <circle cx={toX(activeIndex)} cy={toY(activePoint.value)} r={5} className={styles.marker} />
            </g>
          ) : null}
        </svg>
        {activePoint ? (
          <div className={styles.tooltip} style={{ left: tooltipLeft }} aria-hidden>
            <p className={styles.tooltipLabel}>{activePoint.label}</p>
            <p className={styles.tooltipRow}>
              <span className={styles.tooltipSwatch} />
              {seriesLabel}: <strong>{activePoint.formattedValue}</strong>
            </p>
            {activeComparison ? (
              <p className={styles.tooltipRow}>
                <span className={`${styles.tooltipSwatch} ${styles.tooltipSwatchCompare}`} />
                {comparisonLabel} ({activeComparison.label}): <strong>{activeComparison.formattedValue}</strong>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="visuallyHidden" aria-live="polite">
        {activePoint ? `${activePoint.label}: ${seriesLabel} ${activePoint.formattedValue}${activeComparison ? `, ${comparisonLabel} ${activeComparison.formattedValue}` : ""}` : ""}
      </p>
      <table className="visuallyHidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{seriesLabel}</th>
            {hasComparison ? <th scope="col">{comparisonLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.label + index}>
              <th scope="row">{point.label}</th>
              <td>{point.formattedValue}</td>
              {hasComparison ? <td>{comparisonPoints?.[index]?.formattedValue ?? "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
