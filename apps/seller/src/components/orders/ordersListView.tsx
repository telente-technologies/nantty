"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { orderStatusPresentation, escrowStatusPresentation, ordersSectionTabs } from "@/components/orders/orderPresentation.constant";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, SearchInput, type DateRangeValue } from "@/components/ui/filterControls";
import { LinkTabs } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { OnlineOrder, OnlineOrderStatus } from "@/types/order.type";
import type { CursorPage } from "@/types/pagination.type";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";

type OrdersPage = CursorPage<OnlineOrder> & { readonly countsByStatus?: Partial<Record<OnlineOrderStatus, number>> };

const statusFilterOrder: (OnlineOrderStatus | "all")[] = ["all", "paid", "processing", "shipped", "delivered", "completed", "disputed", "cancelled", "refunded"];

export function OrdersListView({ initialStatusFilter = "all" }: { readonly initialStatusFilter?: OnlineOrderStatus | "all" }) {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<OnlineOrderStatus | "all">(initialStatusFilter);
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const ordersList = useCommerceCursorList<OnlineOrder, OrdersPage>("/seller/orders", { status: statusFilter, q: searchText, from: dateRange.from, to: dateRange.to, limit: 25 });
  const countsByStatus = ordersList.firstPage?.countsByStatus ?? {};

  const columns: DataTableColumn<OnlineOrder>[] = [
    { key: "order", header: "Order", render: (order) => <span className={styles.primaryCell}><strong>{order.orderNumber}</strong><span className={styles.muted}>{formatDateTimeForDisplay(order.createdAt)}</span></span> },
    { key: "buyer", header: "Buyer", render: (order) => <span className={styles.primaryCell}><span>{order.buyer.name}</span><span className={styles.muted}>@{order.buyer.username} · {order.shippingAddress.city}</span></span> },
    { key: "items", header: "Items", align: "end", hideBelowTablet: true, render: (order) => order.lines.reduce((sum, line) => sum + line.quantity, 0) },
    { key: "total", header: "Total", align: "end", render: (order) => formatMoney(order.total) },
    { key: "status", header: "Status", render: (order) => <StatusBadge tone={orderStatusPresentation[order.status].tone}>{orderStatusPresentation[order.status].label}</StatusBadge> },
    { key: "escrow", header: "Escrow", hideBelowTablet: true, render: (order) => <StatusBadge tone={escrowStatusPresentation[order.escrowStatus].tone}>{escrowStatusPresentation[order.escrowStatus].label}</StatusBadge> },
    { key: "creator", header: "Creator", hideBelowTablet: true, render: (order) => (order.attributedCreator ? `@${order.attributedCreator.username}` : <span className={styles.muted}>—</span>) },
  ];

  return (
    <PageStack>
      <PageHeader title="Orders" description="Marketplace orders paid into escrow. Pack and ship paid orders; you are paid when the buyer confirms delivery." />
      <LinkTabs label="Order sections" tabs={ordersSectionTabs} />
      <div className={styles.chipRow} role="group" aria-label="Filter by status">
        {statusFilterOrder.map((status) => (
          <button key={status} type="button" className={styles.chip} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>
            {status === "all" ? "All" : orderStatusPresentation[status].label}
            {status !== "all" && countsByStatus[status] ? <span className={styles.chipCount}>{countsByStatus[status]}</span> : null}
          </button>
        ))}
      </div>
      <FilterBar>
        <SearchInput label="Search orders" placeholder="Order number or buyer" value={searchText} onValueChange={setSearchText} />
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
      </FilterBar>
      {ordersList.errorMessage ? <Callout tone="error">{ordersList.errorMessage}</Callout> : null}
      <Panel padded={false}>
        <DataTable
          caption="Online orders"
          columns={columns}
          rows={ordersList.items}
          readRowKey={(order) => order.id}
          isLoading={ordersList.isLoading}
          onRowActivate={(order) => router.push(`/orders/${order.id}`)}
          hasMore={ordersList.hasMore}
          onLoadMore={ordersList.loadMore}
          isLoadingMore={ordersList.isLoadingMore}
          emptyState={<EmptyState iconName="truck24" title="No orders match these filters" description="Try another status or a wider date range." />}
        />
      </Panel>
    </PageStack>
  );
}
