"use client";

import { formatAnalyticsPeriodLabels } from "@/components/analytics/analyticsLabels.util";
import { LineChart } from "@/components/charts/lineChart";
import { describeChangeBetweenNumbers } from "@/components/dashboard/dashboardSalesPanels";
import { StatTile } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { AnalyticsOverview } from "@/types/analytics.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./analytics.module.css";

export function AnalyticsKpiTiles({ overview }: { readonly overview: AnalyticsOverview }) {
  const { formatMoney } = useMoneyFormatter();
  const { previous } = overview;
  const comparison = "the period before";
  const grossChange = describeChangeBetweenNumbers(overview.grossSales.amountMinor, previous.grossSales.amountMinor, comparison);
  const netChange = describeChangeBetweenNumbers(overview.netSales.amountMinor, previous.netSales.amountMinor, comparison);
  const orderChange = describeChangeBetweenNumbers(overview.ordersCount, previous.ordersCount, comparison);
  const averageChange = describeChangeBetweenNumbers(overview.averageOrderValue.amountMinor, previous.averageOrderValue.amountMinor, comparison);
  const conversionChange = describeChangeBetweenNumbers(overview.conversionRateBasisPoints, previous.conversionRateBasisPoints, comparison);
  return (
    <div className={styles.kpiGrid}>
      <StatTile label="Gross sales" value={formatMoney(overview.grossSales)} detail={grossChange.text} tone={grossChange.tone} />
      <StatTile label="Net sales" value={formatMoney(overview.netSales)} detail={netChange.text} tone={netChange.tone} />
      <StatTile label="Orders" value={overview.ordersCount.toLocaleString("en-NG")} detail={`${orderChange.text} · ${overview.unitsSold} units`} tone={orderChange.tone} />
      <StatTile label="Average order value" value={formatMoney(overview.averageOrderValue)} detail={averageChange.text} tone={averageChange.tone} />
      <StatTile label="Conversion rate" value={formatBasisPointsAsPercent(overview.conversionRateBasisPoints)} detail={`${conversionChange.text} · ${overview.visitors.toLocaleString("en-NG")} visitors`} tone={conversionChange.tone} />
      <StatTile label="Refunds" value={formatMoney(overview.refunds)} detail={`${overview.refundedOrdersCount} ${overview.refundedOrdersCount === 1 ? "refund" : "refunds"}`} tone={overview.refundedOrdersCount > 0 ? "caution" : "neutral"} />
    </div>
  );
}

export function AnalyticsSalesChartPanel({ overview }: { readonly overview: AnalyticsOverview }) {
  const { formatMoney, formatMoneyCompact, locale } = useMoneyFormatter();
  const currency = overview.grossSales.currency;
  const points = overview.series.map((point) => ({ ...formatAnalyticsPeriodLabels(point.periodStart, overview.bucket, locale), values: { gross: point.grossSales.amountMinor, net: point.netSales.amountMinor } }));
  const bucketDescription = overview.bucket === "hour" ? "by hour" : overview.bucket === "day" ? "by day" : overview.bucket === "week" ? "by week" : "by month";
  return (
    <Panel title="Revenue" description={`Gross and net sales ${bucketDescription}`}>
      {points.length === 0 ? (
        <p className={styles.muted}>No sales in this period.</p>
      ) : (
        <LineChart
          title={`Gross and net sales ${bucketDescription}`}
          description="Two lines: gross sales from app orders and net sales after refunds and Nantty fees."
          series={[
            { key: "gross", label: "Gross sales", colorVariable: "--chart-1" },
            { key: "net", label: "Net sales", colorVariable: "--success" },
          ]}
          points={points}
          formatValue={(value) => formatMoney({ amountMinor: value, currency })}
          formatAxisValue={(value) => formatMoneyCompact({ amountMinor: value, currency })}
        />
      )}
    </Panel>
  );
}

export function AnalyticsNetSalesBreakdownPanel({ overview }: { readonly overview: AnalyticsOverview }) {
  const { formatMoney } = useMoneyFormatter();
  const negative = (amountMinor: number) => formatMoney({ amountMinor: -amountMinor, currency: overview.grossSales.currency });
  return (
    <Panel title="From gross to net" description="What you keep from app orders in this period">
      <KeyValueList
        items={[
          { label: "Gross sales", value: formatMoney(overview.grossSales) },
          { label: "Refunds", value: negative(overview.refunds.amountMinor) },
          { label: "Nantty fees", value: negative(overview.fees.amountMinor) },
          { label: "Net sales", value: <strong>{formatMoney(overview.netSales)}</strong> },
          { label: "Store views", value: overview.storeViews.toLocaleString("en-NG") },
        ]}
      />
    </Panel>
  );
}
