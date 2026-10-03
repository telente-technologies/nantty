"use client";

import { LineChart } from "@/components/charts/lineChart";
import { ButtonLink } from "@/components/ui/button";
import { StatTile } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { DashboardPeriodSales, DashboardSummary } from "@/types/dashboard.type";
import { formatShortDateLabel } from "@/utils/chartScale.util";

import styles from "./dashboard.module.css";

export function describeChangeBetweenNumbers(current: number, previous: number, comparisonLabel: string): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (previous === 0) return { text: current > 0 ? `New vs ${comparisonLabel}` : `No change vs ${comparisonLabel}`, tone: "neutral" };
  const changePercent = Math.round(((current - previous) / previous) * 1000) / 10;
  return { text: `${changePercent >= 0 ? "+" : "-"}${Math.abs(changePercent)}% vs ${comparisonLabel}`, tone: changePercent >= 0 ? "positive" : "negative" };
}

function describePeriodChange(period: DashboardPeriodSales, comparisonLabel: string) {
  return describeChangeBetweenNumbers(period.current.amountMinor, period.previous.amountMinor, comparisonLabel);
}

export function DashboardSalesKpiRow({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney } = useMoneyFormatter();
  const todayChange = describePeriodChange(summary.salesToday, "yesterday");
  const weekChange = describePeriodChange(summary.salesThisWeek, "the week before");
  const monthChange = describePeriodChange(summary.salesThisMonth, "the 30 days before");
  const countOrders = (count: number) => `${count} ${count === 1 ? "order" : "orders"}`;
  return (
    <div className={styles.kpiRow}>
      <StatTile label="Sales today" value={formatMoney(summary.salesToday.current)} detail={`${todayChange.text} · ${countOrders(summary.salesToday.ordersCount)}`} tone={todayChange.tone} />
      <StatTile label="Sales · last 7 days" value={formatMoney(summary.salesThisWeek.current)} detail={`${weekChange.text} · ${countOrders(summary.salesThisWeek.ordersCount)}`} tone={weekChange.tone} />
      <StatTile label="Revenue · last 30 days" value={formatMoney(summary.salesThisMonth.current)} detail={`${monthChange.text} · ${countOrders(summary.salesThisMonth.ordersCount)}`} tone={monthChange.tone} />
      <StatTile label="Total sales" value={formatMoney(summary.lifetimeSales.total)} detail={`${countOrders(summary.lifetimeSales.ordersCount)} since you opened`} />
    </div>
  );
}

export function DashboardRevenueChartPanel({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney, formatMoneyCompact, currency, locale } = useMoneyFormatter();
  const chartCurrency = currency ?? summary.salesToday.current.currency;
  const points = summary.dailyRevenue.map((point) => ({
    label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T12:00:00.000Z`)),
    shortLabel: formatShortDateLabel(point.date, locale),
    values: { revenue: point.revenue.amountMinor },
  }));
  return (
    <Panel title="Sales, last 30 days" description="Orders customers placed in the Zudomart app, before fees and refunds" actions={<ButtonLink href="/analytics" size="small">Open analytics</ButtonLink>}>
      <LineChart
        title="Daily sales for the last 30 days"
        description="A line showing sales from app orders for each of the last 30 days."
        series={[{ key: "revenue", label: "Sales", colorVariable: "--chart-1" }]}
        points={points}
        formatValue={(value) => formatMoney({ amountMinor: value, currency: chartCurrency })}
        formatAxisValue={(value) => formatMoneyCompact({ amountMinor: value, currency: chartCurrency })}
      />
    </Panel>
  );
}
