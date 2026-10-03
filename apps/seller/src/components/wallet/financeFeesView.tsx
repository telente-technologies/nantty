"use client";

import { useState } from "react";

import { DonutChart } from "@/components/charts/donutChart";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, LoadingBlock, StatTile } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { FinanceFeeBreakdown, FinanceFeeKind } from "@/types/finance.type";
import { buildDateRangeEndingToday } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./wallet.module.css";

const feeColorVariables: Record<FinanceFeeKind, string> = {
  escrow_fee: "--chart-1",
  payment_processing: "--chart-4",
  withdrawal: "--chart-2",
  ads: "--chart-compare",
  subscription: "--caution",
};

function calculateShareOfGrossText(amountMinor: number, grossMinor: number): string {
  return grossMinor === 0 ? "—" : formatBasisPointsAsPercent(Math.round((amountMinor * 10_000) / grossMinor));
}

export function FinanceFeesView() {
  const { formatMoney } = useMoneyFormatter();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(30));
  const feesQuery = useSellerQuery<FinanceFeeBreakdown>("/seller/finance/fees", { from: dateRange.from, to: dateRange.to });
  const breakdown = feesQuery.data;
  const nonZeroLines = breakdown?.lines.filter((line) => line.amount.amountMinor > 0) ?? [];

  return (
    <PageStack>
      <PageHeader title="Fees" description="What you paid to sell on Zudomart. The payment processing fee and, on escrow orders, the escrow fee come out of each order before it reaches your wallet." />
      <WalletTabs />
      <FilterBar>
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
      </FilterBar>
      {feesQuery.errorMessage && !breakdown ? <Callout tone="error" action={<Button size="small" onClick={feesQuery.reload}>Try again</Button>}>{feesQuery.errorMessage}</Callout> : null}
      {!breakdown && feesQuery.isLoading ? <LoadingBlock label="Loading fees" /> : null}
      {breakdown ? (
        <>
          <ResponsiveGrid minimumColumnWidth={200}>
            <StatTile label="Gross sales" value={formatMoney(breakdown.grossSales)} />
            <StatTile label="Total fees" value={formatMoney(breakdown.totalFees)} detail={`${calculateShareOfGrossText(breakdown.totalFees.amountMinor, breakdown.grossSales.amountMinor)} of sales`} />
            <StatTile label="Net earnings" value={formatMoney(breakdown.netEarnings)} tone="positive" />
          </ResponsiveGrid>
          <div className={styles.overviewGrid}>
            <Panel padded={false} title="Breakdown">
              <DataTable
                caption="Fee breakdown"
                rows={breakdown.lines}
                readRowKey={(line) => line.kind}
                columns={[
                  { key: "fee", header: "Fee", render: (line) => <span className={styles.primaryCell}><strong>{line.label}</strong><span className={styles.muted}>{line.description}</span></span> },
                  { key: "rate", header: "Rate", align: "end", hideBelowTablet: true, render: (line) => (line.rateBasisPoints === null ? "—" : formatBasisPointsAsPercent(line.rateBasisPoints)) },
                  { key: "count", header: "Charges", align: "end", hideBelowTablet: true, render: (line) => line.count },
                  { key: "amount", header: "Amount", align: "end", render: (line) => formatMoney(line.amount) },
                  { key: "share", header: "Of sales", align: "end", hideBelowTablet: true, render: (line) => calculateShareOfGrossText(line.amount.amountMinor, breakdown.grossSales.amountMinor) },
                ]}
              />
            </Panel>
            <Panel title="Where fees go">
              {nonZeroLines.length > 0 ? (
                <DonutChart
                  title="Fees by type"
                  centerLabel="Fees"
                  centerValue={formatMoney(breakdown.totalFees)}
                  segments={nonZeroLines.map((line) => ({ key: line.kind, label: line.label, value: line.amount.amountMinor, displayValue: formatMoney(line.amount), colorVariable: feeColorVariables[line.kind] }))}
                />
              ) : (
                <p className={styles.muted}>No fees in this period.</p>
              )}
            </Panel>
          </div>
          <Callout tone="info" title="Withdrawal fees">The withdrawal fee is the transfer charge for sending money to your bank. Zudomart adds nothing on top.</Callout>
        </>
      ) : null}
    </PageStack>
  );
}
