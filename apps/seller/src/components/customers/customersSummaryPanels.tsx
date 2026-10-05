"use client";

import { formatMonthKeyAsLongLabel, formatMonthKeyAsShortLabel } from "@/components/customers/customerPresentation.util";
import { StackedBarChart } from "@/components/charts/stackedBarChart";
import { ErrorCallout, StatTile } from "@/components/ui/feedback";
import { Panel, ResponsiveGrid } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { CustomersSummary } from "@/types/customer.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

export function CustomersSummaryPanels() {
  const { formatMoney, locale } = useMoneyFormatter();
  const summaryQuery = useSellerQuery<CustomersSummary>("/seller/customers/summary");
  const summary = summaryQuery.data;
  if (summaryQuery.errorMessage && !summary) return <ErrorCallout message={summaryQuery.errorMessage} onRetry={summaryQuery.reload} />;
  return (
    <>
      <ResponsiveGrid minimumColumnWidth={170}>
        <StatTile label="Customers" value={summary ? summary.totalCustomers.toLocaleString(locale) : "…"} />
        <StatTile label="New this month" value={summary ? summary.newThisMonth.toLocaleString(locale) : "…"} tone="positive" detail="First order this month" />
        <StatTile label="Returning" value={summary ? summary.returningCustomers.toLocaleString(locale) : "…"} detail={summary ? `${formatBasisPointsAsPercent(summary.repeatRateBasisPoints)} order again` : undefined} />
        <StatTile label="Average order value" value={summary ? formatMoney(summary.averageOrderValue) : "…"} />
      </ResponsiveGrid>
      {summary ? (
        <Panel title="Customer growth" description="New and returning buyers per month, last 6 months">
          <StackedBarChart
            title="Customer growth by month"
            description="Stacked bars per month: new customers in dark blue, returning customers in light blue."
            series={[
              { key: "newCustomers", label: "New", colorVariable: "--chart-1" },
              { key: "returningCustomers", label: "Returning", colorVariable: "--chart-4" },
            ]}
            points={summary.growth.map((point) => ({ label: formatMonthKeyAsLongLabel(point.month, locale), shortLabel: formatMonthKeyAsShortLabel(point.month, locale), values: { newCustomers: point.newCustomers, returningCustomers: point.returningCustomers } }))}
            formatValue={(value) => `${value} customers`}
            formatAxisValue={(value) => String(value)}
            height={200}
          />
        </Panel>
      ) : null}
    </>
  );
}
