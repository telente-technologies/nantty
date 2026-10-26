"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { escrowStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, StatTile } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { EscrowEntriesPage, EscrowEntry } from "@/types/finance.type";
import type { EscrowStatus } from "@/types/order.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";

const escrowStatusFilterOrder: (EscrowStatus | "all")[] = ["all", "held", "released", "disputed", "refunded"];

const escrowSortValueReaders = {
  order: (entry: EscrowEntry) => entry.orderNumber,
  heldAt: (entry: EscrowEntry) => entry.heldAt,
  gross: (entry: EscrowEntry) => entry.gross.amountMinor,
  fees: (entry: EscrowEntry) => entry.fees.amountMinor,
  net: (entry: EscrowEntry) => entry.net.amountMinor,
  release: (entry: EscrowEntry) => entry.releasedAt ?? entry.releaseExpectedAt,
};

export function EscrowTransactionsView() {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<EscrowStatus | "all">("all");
  const [searchText, setSearchText] = useState("");
  const escrowQuery = useSellerQuery<EscrowEntriesPage>("/seller/finance/escrow", { status: statusFilter === "all" ? undefined : statusFilter, q: searchText, limit: 200 });
  const page = escrowQuery.data;
  const tableState = useClientTableState(page?.data ?? null, escrowSortValueReaders, { pageSize: 15, initialSort: { key: "heldAt", direction: "descending" } });

  const columns = useMemo<DataTableColumn<EscrowEntry>[]>(
    () => [
      { key: "order", header: "Order", sortKey: "order", render: (entry) => <span className={styles.primaryCell}><strong>{entry.orderNumber}</strong><span className={styles.muted}>{entry.buyerName} · @{entry.buyerUsername}</span></span> },
      { key: "heldAt", header: "Paid", sortKey: "heldAt", hideBelowTablet: true, render: (entry) => formatDateTimeForDisplay(entry.heldAt) },
      { key: "gross", header: "Items total", sortKey: "gross", align: "end", hideBelowTablet: true, render: (entry) => formatMoney(entry.gross) },
      { key: "fees", header: "Fees", sortKey: "fees", align: "end", hideBelowTablet: true, render: (entry) => `−${formatMoney(entry.fees)}` },
      { key: "net", header: "You get", sortKey: "net", align: "end", render: (entry) => <strong>{formatMoney(entry.net)}</strong> },
      { key: "status", header: "Escrow", render: (entry) => <StatusBadge tone={escrowStatusPresentation[entry.status].tone}>{escrowStatusPresentation[entry.status].label}</StatusBadge> },
      {
        key: "release",
        header: "Release",
        sortKey: "release",
        hideBelowTablet: true,
        render: (entry) => (entry.settlementId ? <Link href={`/wallet/settlements/${entry.settlementId}`} onClick={(event) => event.stopPropagation()}>{formatDateTimeForDisplay(entry.releasedAt)}</Link> : entry.releaseExpectedAt ? <span className={styles.muted}>Expected {formatDateTimeForDisplay(entry.releaseExpectedAt)}</span> : "—"),
      },
    ],
    [formatMoney],
  );

  return (
    <PageStack>
      <PageHeader title="Escrow" description="Every app order is paid into escrow first. You see what the buyer paid, Nantty's fees and what reaches your wallet once delivery is confirmed." />
      <WalletTabs />
      {page ? (
        <ResponsiveGrid minimumColumnWidth={180}>
          {(["held", "released", "disputed", "refunded"] as const).map((status) => (
            <StatTile key={status} label={escrowStatusPresentation[status].label} value={formatMoney(page.totalsByStatus[status])} detail={`${page.countsByStatus[status]} orders`} tone={status === "disputed" && page.countsByStatus[status] > 0 ? "negative" : "neutral"} />
          ))}
        </ResponsiveGrid>
      ) : null}
      <div className={styles.chipRow} role="group" aria-label="Filter by escrow status">
        {escrowStatusFilterOrder.map((status) => (
          <button key={status} type="button" className={styles.chip} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>
            {status === "all" ? "All" : escrowStatusPresentation[status].label}
            {status !== "all" && page ? <span className={styles.chipCount}>{page.countsByStatus[status]}</span> : null}
          </button>
        ))}
      </div>
      <FilterBar>
        <SearchInput label="Search escrow" placeholder="Order number or buyer" value={searchText} onValueChange={setSearchText} />
      </FilterBar>
      <Panel padded={false}>
        <DataTable
          caption="Escrow transactions"
          columns={columns}
          rows={tableState.visibleRows}
          readRowKey={(entry) => entry.orderId}
          isLoading={escrowQuery.isLoading}
          errorMessage={escrowQuery.errorMessage}
          onRetry={escrowQuery.reload}
          sortState={tableState.sortState}
          onSortChange={tableState.setSortState}
          onRowActivate={(entry) => router.push(`/orders/${entry.orderId}`)}
          emptyState={<EmptyState iconName="creditCard24" title="No escrow entries match" description="Try another status or search." />}
          footer={<TablePagination pageIndex={tableState.pageIndex} pageCount={tableState.pageCount} totalCount={tableState.totalCount} pageSize={tableState.pageSize} onPageChange={tableState.setPageIndex} itemLabel="orders" />}
        />
      </Panel>
    </PageStack>
  );
}
