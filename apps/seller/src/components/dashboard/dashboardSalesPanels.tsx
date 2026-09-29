"use client";

import { DonutChart } from "@/components/charts/donutChart";
import { StackedBarChart } from "@/components/charts/stackedBarChart";
import { StatTile } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { DashboardPeriodSales, DashboardSummary } from "@/types/dashboard.type";
import { formatShortDateLabel } from "@/utils/chartScale.util";

import styles from "./dashboard.module.css";

function describeChangeAgainstPreviousPeriod(period: DashboardPeriodSales, comparisonLabel: string): { text: string; tone: "positive" | "negative" | "neutral" } {
  const previousMinor = period.previous.amountMinor;
  const currentMinor = period.current.amountMinor;
  if (previousMinor === 0) return { text: currentMinor > 0 ? `No sales ${comparisonLabel}` : "No sales yet", tone: "neutral" };
  const changePercent = Math.round(((currentMinor - previousMinor) / previousMinor) * 1000) / 10;
  return { text: `${changePercent >= 0 ? "▲" : "▼"} ${Math.abs(changePercent)}% vs ${comparisonLabel}`, tone: changePercent >= 0 ? "positive" : "negative" };
}

export function DashboardSalesKpiRow({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney } = useMoneyFormatter();
  const periods: { period: DashboardPeriodSales; comparisonLabel: string }[] = [
    { period: summary.salesToday, comparisonLabel: "yesterday" },
    { period: summary.salesThisWeek, comparisonLabel: "the 7 days before" },
    { period: summary.salesThisMonth, comparisonLabel: "the 30 days before" },
  ];
  return (
    <div className={styles.kpiRow}>
      {periods.map(({ period, comparisonLabel }) => {
        const change = describeChangeAgainstPreviousPeriod(period, comparisonLabel);
        return (
          <StatTile
            key={period.label}
            label={`Sales · ${period.label}`}
            value={formatMoney(period.current)}
            detail={`${change.text} · ${period.transactionsCount} ${period.transactionsCount === 1 ? "transaction" : "transactions"}`}
            tone={change.tone}
          />
        );
      })}
    </div>
  );
}

export function DashboardRevenueChartPanel({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney, formatMoneyCompact, currency, locale } = useMoneyFormatter();
  const chartCurrency = currency ?? summary.salesToday.current.currency;
  const points = summary.dailyRevenue.map((point) => ({
    label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T12:00:00.000Z`)),
    shortLabel: formatShortDateLabel(point.date, locale),
    values: { pos: point.pos.amountMinor, online: point.online.amountMinor },
  }));
  return (
    <Panel title="Revenue, last 30 days" description="In-store register sales and online marketplace orders">
      <StackedBarChart
        title="Daily revenue for the last 30 days"
        description="Stacked bars per day: in-store sales in dark blue and online orders in light blue."
        series={[
          { key: "pos", label: "In store", colorVariable: "--blue-500" },
          { key: "online", label: "Online", colorVariable: "--blue-200" },
        ]}
        points={points}
        formatValue={(value) => formatMoney({ amountMinor: value, currency: chartCurrency })}
        formatAxisValue={(value) => formatMoneyCompact({ amountMinor: value, currency: chartCurrency })}
      />
    </Panel>
  );
}

export function DashboardChannelSplitPanel({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney, formatMoneyCompact } = useMoneyFormatter();
  const { online, pos } = summary.channelSplit;
  return (
    <Panel title="Online vs in store" description="Share of revenue, last 30 days">
      <DonutChart
        title="Revenue by channel"
        centerLabel="Total"
        centerValue={formatMoneyCompact({ amountMinor: online.amountMinor + pos.amountMinor, currency: pos.currency })}
        segments={[
          { key: "pos", label: "In store (register)", value: pos.amountMinor, displayValue: formatMoney(pos), colorVariable: "--blue-500" },
          { key: "online", label: "Online marketplace", value: online.amountMinor, displayValue: formatMoney(online), colorVariable: "--blue-200" },
        ]}
      />
    </Panel>
  );
}
