"use client";

import Link from "next/link";
import { useState } from "react";

import { formatHourSlotLabel, weekdayShortNames } from "@/components/analytics/analyticsLabels.util";
import { HorizontalBarList } from "@/components/charts/horizontalBarList";
import { StackedBarChart } from "@/components/charts/stackedBarChart";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { Panel } from "@/components/ui/panel";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState, type TableSortValueReader } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { AnalyticsBreakdowns, AnalyticsRefundRow, AnalyticsSegmentRow } from "@/types/analytics.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./analytics.module.css";

function useSegmentBarItems(rows: readonly AnalyticsSegmentRow[]) {
  const { formatMoney } = useMoneyFormatter();
  return rows.map((row) => ({ key: row.key, label: row.label, value: row.revenue.amountMinor, displayValue: formatMoney(row.revenue), detail: `${row.ordersCount} orders · ${row.unitsSold} units · ${formatBasisPointsAsPercent(row.shareBasisPoints)} of sales` }));
}

export function AnalyticsCategoryPanel({ breakdowns }: { readonly breakdowns: AnalyticsBreakdowns }) {
  const items = useSegmentBarItems(breakdowns.byCategory);
  return (
    <Panel title="Sales by category">
      <HorizontalBarList title="Sales by category" items={items} />
    </Panel>
  );
}

export function AnalyticsLocationPanel({ breakdowns }: { readonly breakdowns: AnalyticsBreakdowns }) {
  const [level, setLevel] = useState<"state" | "city">("state");
  const items = useSegmentBarItems(level === "state" ? breakdowns.byState : breakdowns.byCity);
  return (
    <Panel
      title="Sales by location"
      description="Where buyers had their orders delivered"
      actions={<SegmentedControl label="Location level" value={level} onValueChange={setLevel} options={[{ value: "state", label: "State" }, { value: "city", label: "City" }]} />}
    >
      <HorizontalBarList title={`Sales by ${level}`} items={items} colorVariable="--chart-4" />
    </Panel>
  );
}

export function AnalyticsTimePanel({ breakdowns }: { readonly breakdowns: AnalyticsBreakdowns }) {
  const { formatMoney, formatMoneyCompact } = useMoneyFormatter();
  const currency = breakdowns.byHourOfDay[0]?.revenue.currency ?? "NGN";
  const busiestWeekday = [...breakdowns.byWeekday].sort((first, second) => second.ordersCount - first.ordersCount)[0];
  return (
    <Panel title="Sales by time" description={busiestWeekday && busiestWeekday.ordersCount > 0 ? `${weekdayShortNames[busiestWeekday.slot]} is your busiest day` : "When buyers place orders"}>
      <div className={styles.verticalStack}>
      <StackedBarChart
        title="Sales by hour of day"
        description="Bars for each hour of the day showing sales from app orders placed in that hour."
        series={[{ key: "revenue", label: "Sales by hour", colorVariable: "--chart-1" }]}
        points={breakdowns.byHourOfDay.map((row) => ({ label: formatHourSlotLabel(row.slot), shortLabel: String(row.slot).padStart(2, "0"), values: { revenue: row.revenue.amountMinor } }))}
        formatValue={(value) => formatMoney({ amountMinor: value, currency })}
        formatAxisValue={(value) => formatMoneyCompact({ amountMinor: value, currency })}
        height={200}
      />
      <HorizontalBarList
        title="Orders by weekday"
        colorVariable="--chart-4"
        items={breakdowns.byWeekday.map((row) => ({ key: String(row.slot), label: weekdayShortNames[row.slot] ?? String(row.slot), value: row.ordersCount, displayValue: `${row.ordersCount} orders`, detail: formatMoney(row.revenue) }))}
      />
      </div>
    </Panel>
  );
}

const refundSortValueReaders: Record<string, TableSortValueReader<AnalyticsRefundRow>> = {
  refundedAt: (row) => row.refundedAt,
  amount: (row) => row.amount.amountMinor,
  customer: (row) => row.customerName,
};

export function AnalyticsRefundsPanel({ breakdowns }: { readonly breakdowns: AnalyticsBreakdowns }) {
  const { formatMoney } = useMoneyFormatter();
  const table = useClientTableState(breakdowns.refunds, refundSortValueReaders, { pageSize: 6, initialSort: { key: "refundedAt", direction: "descending" } });
  const columns: DataTableColumn<AnalyticsRefundRow>[] = [
    { key: "order", header: "Order", render: (row) => <Link href={`/orders/${row.orderId}`}>{row.orderNumber}</Link> },
    { key: "customer", header: "Customer", sortKey: "customer", render: (row) => row.customerName },
    { key: "reason", header: "Reason", hideBelowTablet: true, render: (row) => row.reason },
    { key: "refundedAt", header: "Date", sortKey: "refundedAt", hideBelowTablet: true, render: (row) => formatDateTimeForDisplay(row.refundedAt) },
    { key: "amount", header: "Amount", sortKey: "amount", align: "end", render: (row) => formatMoney(row.amount) },
  ];
  return (
    <Panel title="Refunds" description="Cancelled orders and approved returns paid back to buyers" padded={false}>
      <DataTable
        caption="Refunds in this period"
        columns={columns}
        rows={table.visibleRows}
        readRowKey={(row) => row.id}
        sortState={table.sortState}
        onSortChange={table.setSortState}
        emptyState={<EmptyState iconName="repeat24" title="No refunds in this period" />}
        footer={table.totalCount > table.pageSize ? <TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="refunds" /> : undefined}
      />
    </Panel>
  );
}
