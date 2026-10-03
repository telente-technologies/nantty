"use client";

import { useRouter } from "next/navigation";

import { WalletTabs } from "@/components/wallet/walletTabs";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Settlement } from "@/types/finance.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";

const settlementSortValueReaders = {
  period: (settlement: Settlement) => settlement.periodStart,
  orders: (settlement: Settlement) => settlement.ordersCount,
  gross: (settlement: Settlement) => settlement.gross.amountMinor,
  net: (settlement: Settlement) => settlement.net.amountMinor,
};

export function SettlementsView() {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const settlementsQuery = useSellerQuery<CursorPage<Settlement>>("/seller/finance/settlements", { limit: 200 });
  const tableState = useClientTableState(settlementsQuery.data?.data ?? null, settlementSortValueReaders, { pageSize: 12, initialSort: { key: "period", direction: "descending" } });
  return (
    <PageStack>
      <PageHeader title="Settlements" description="Each week, escrow released for delivered orders is settled into your wallet in one batch. Open a settlement to see the orders in it." />
      <WalletTabs />
      <Panel padded={false}>
        <DataTable
          caption="Settlements"
          rows={tableState.visibleRows}
          readRowKey={(settlement) => settlement.id}
          isLoading={settlementsQuery.isLoading}
          errorMessage={settlementsQuery.errorMessage}
          onRetry={settlementsQuery.reload}
          sortState={tableState.sortState}
          onSortChange={tableState.setSortState}
          onRowActivate={(settlement) => router.push(`/wallet/settlements/${settlement.id}`)}
          emptyState={<EmptyState iconName="creditCard24" title="No settlements yet" description="Your first settlement appears after a buyer confirms delivery." />}
          footer={<TablePagination pageIndex={tableState.pageIndex} pageCount={tableState.pageCount} totalCount={tableState.totalCount} pageSize={tableState.pageSize} onPageChange={tableState.setPageIndex} itemLabel="settlements" />}
          columns={[
            { key: "period", header: "Week", sortKey: "period", render: (settlement) => <span className={styles.primaryCell}><strong>{settlement.reference}</strong><span className={styles.muted}>{formatDateForDisplay(settlement.periodStart)} – {formatDateForDisplay(settlement.periodEnd)}</span></span> },
            { key: "orders", header: "Orders", sortKey: "orders", align: "end", hideBelowTablet: true, render: (settlement) => settlement.ordersCount },
            { key: "gross", header: "Gross", sortKey: "gross", align: "end", hideBelowTablet: true, render: (settlement) => formatMoney(settlement.gross) },
            { key: "fees", header: "Fees", align: "end", hideBelowTablet: true, render: (settlement) => `−${formatMoney(settlement.fees)}` },
            { key: "net", header: "Net to wallet", sortKey: "net", align: "end", render: (settlement) => <strong>{formatMoney(settlement.net)}</strong> },
            { key: "status", header: "Status", render: (settlement) => <StatusBadge tone={settlement.status === "settled" ? "success" : "info"}>{settlement.status === "settled" ? "Settled" : "Clearing"}</StatusBadge> },
          ]}
        />
      </Panel>
    </PageStack>
  );
}
