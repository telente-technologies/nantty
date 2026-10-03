"use client";

import Link from "next/link";
import { useState } from "react";

import { refundKindPresentation } from "@/components/wallet/walletPresentation.constant";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState, StatTile } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, SearchInput, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { RefundEntry } from "@/types/finance.type";
import type { CursorPage } from "@/types/pagination.type";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";

const refundSortValueReaders = {
  date: (refund: RefundEntry) => refund.createdAt,
  order: (refund: RefundEntry) => refund.orderNumber,
  amount: (refund: RefundEntry) => refund.amount.amountMinor,
};

export function FinanceRefundsView() {
  const { formatMoney, currency } = useMoneyFormatter();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const [searchText, setSearchText] = useState("");
  const refundsQuery = useSellerQuery<CursorPage<RefundEntry>>("/seller/finance/refunds", { from: dateRange.from, to: dateRange.to, q: searchText, limit: 200 });
  const refunds = refundsQuery.data?.data ?? null;
  const tableState = useClientTableState(refunds, refundSortValueReaders, { pageSize: 15, initialSort: { key: "date", direction: "descending" } });
  const totalRefundedMinor = (refunds ?? []).reduce((sum, refund) => sum + refund.amount.amountMinor, 0);
  const feesReturnedMinor = (refunds ?? []).reduce((sum, refund) => sum + refund.feesReturned.amountMinor, 0);

  return (
    <PageStack>
      <PageHeader title="Refunds" description="Money that went back to buyers from escrow: orders cancelled before shipping, refunded orders and approved returns. Fees on refunded orders are returned to you." />
      <WalletTabs />
      <FilterBar>
        <SearchInput label="Search refunds" placeholder="Order number or buyer" value={searchText} onValueChange={setSearchText} />
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
      </FilterBar>
      {refunds && currency ? (
        <ResponsiveGrid minimumColumnWidth={200}>
          <StatTile label="Refunds" value={refunds.length} />
          <StatTile label="Refunded to buyers" value={formatMoney({ amountMinor: totalRefundedMinor, currency })} tone={totalRefundedMinor > 0 ? "caution" : "neutral"} />
          <StatTile label="Fees returned to you" value={formatMoney({ amountMinor: feesReturnedMinor, currency })} />
        </ResponsiveGrid>
      ) : null}
      <Panel padded={false}>
        <DataTable
          caption="Refunds"
          rows={tableState.visibleRows}
          readRowKey={(refund) => refund.id}
          isLoading={refundsQuery.isLoading}
          errorMessage={refundsQuery.errorMessage}
          onRetry={refundsQuery.reload}
          sortState={tableState.sortState}
          onSortChange={tableState.setSortState}
          emptyState={<EmptyState iconName="repeat24" title="No refunds in this period" description="Good news — nothing went back to buyers." />}
          footer={<TablePagination pageIndex={tableState.pageIndex} pageCount={tableState.pageCount} totalCount={tableState.totalCount} pageSize={tableState.pageSize} onPageChange={tableState.setPageIndex} itemLabel="refunds" />}
          columns={[
            { key: "date", header: "Date", sortKey: "date", render: (refund) => formatDateTimeForDisplay(refund.createdAt) },
            { key: "order", header: "Order", sortKey: "order", render: (refund) => <span className={styles.primaryCell}><Link href={`/orders/${refund.orderId}`}>{refund.orderNumber}</Link><span className={styles.muted}>{refund.buyerName}</span></span> },
            { key: "kind", header: "Type", render: (refund) => <StatusBadge tone={refundKindPresentation[refund.kind].tone}>{refundKindPresentation[refund.kind].label}</StatusBadge> },
            { key: "reason", header: "Reason", hideBelowTablet: true, render: (refund) => <span className={styles.muted}>{refund.reason}</span> },
            { key: "amount", header: "Refunded", sortKey: "amount", align: "end", render: (refund) => <strong>{formatMoney(refund.amount)}</strong> },
          ]}
        />
      </Panel>
    </PageStack>
  );
}
