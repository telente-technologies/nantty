"use client";

import type { Money } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { buildSellerSalesChart, sellerSalesXAxisIndices } from "@/utils/sellerSalesSeries.util";

import styles from "./sellerSalesSeriesChart.module.css";

interface SellerSalesSeriesChartProps {
  readonly series: readonly { readonly label: string; readonly value: number }[];
  readonly totalSales: Money;
  readonly periodLabel: string;
}

export function SellerSalesSeriesChart({ series, totalSales, periodLabel }: SellerSalesSeriesChartProps) {
  const { currency } = totalSales;
  const chart = buildSellerSalesChart(series);
  const xAxisIndices = sellerSalesXAxisIndices(series.length);

  return (
    <section className={styles.card} aria-labelledby="seller-sales-chart-title">
      <div className={styles.heading}>
        <div>
          <h2 id="seller-sales-chart-title" className={styles.title}>Sales over time</h2>
          <p className={styles.subtitle}>{periodLabel} · amounts use your store currency</p>
        </div>
        <p className={styles.total}>
          <span className={styles.srOnly}>Total shown in chart: </span>
          {formatMoneyForDisplay(totalSales)}
        </p>
      </div>

      {!series.length || !chart.hasSales ? (
        <p className={styles.empty} role="status">
          {series.length ? "No sales recorded in this period." : "Sales data is not available for this period."}
        </p>
      ) : (
        <>
          <div className={styles.plotScroll}>
            <svg className={styles.plot} viewBox="0 0 720 206" role="img" aria-labelledby="seller-sales-chart-title seller-sales-chart-description">
              <desc id="seller-sales-chart-description">Sales by time bucket for {periodLabel.toLowerCase()}. Bar heights are scaled to the highest value in the returned series.</desc>
              {chart.ticks.map((tick, index) => (
                <g key={`${tick.y}-${index}`}>
                  <line x1="72" x2="708" y1={tick.y} y2={tick.y} className={styles.gridLine} />
                  <text x="64" y={tick.y + 4} textAnchor="end" className={styles.tickLabel}>
                    {formatMoneyForDisplay({ amountMinor: tick.value, currency }, { showDecimals: false })}
                  </text>
                </g>
              ))}
              <line x1="72" x2="708" y1={chart.baselineY} y2={chart.baselineY} className={styles.baseline} />
              {chart.points.map((point, index) => (
                <rect
                  key={`${point.label}-${index}`}
                  x={point.x}
                  y={point.y}
                  width={point.width}
                  height={point.height}
                  rx="3"
                  className={styles.bar}
                >
                  <title>{`${point.label}: ${formatMoneyForDisplay({ amountMinor: point.value, currency })}`}</title>
                </rect>
              ))}
            </svg>
          </div>
          <div className={styles.xAxis} aria-hidden="true">
            {xAxisIndices.map((index) => (
              <span key={`${series[index]?.label}-${index}`}>{series[index]?.label}</span>
            ))}
          </div>
          <ul className={styles.srOnly} aria-label={`Sales series for ${periodLabel}`}>
            {series.map((point, index) => (
              <li key={`${point.label}-${index}`}>
                {point.label}: {formatMoneyForDisplay({ amountMinor: Number.isFinite(point.value) ? point.value : 0, currency })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
