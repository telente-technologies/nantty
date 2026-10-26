"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { deliveryStatusPresentation, orderStatusFilterOrder, orderStatusPresentation, ordersSectionTabs, paymentStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { DataTable, type DataTableColumn, type TableSortState } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
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

function countOrderItems(order: OnlineOrder): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function OrdersListView({ initialStatusFilter = "all" }: { readonly initialStatusFilter?: OnlineOrderStatus | "all" }) {
  const router = useRouter();
  const { formatMoney } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<OnlineOrderStatus | "all">(initialStatusFilter);
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const [sortState, setSortState] = useState<TableSortState>({ key: "createdAt", direction: "descending" });
  const ordersList = useCommerceCursorList<OnlineOrder, OrdersPage>("/seller/orders", {
    status: statusFilter,
    q: searchText,
    from: dateRange.from,
    to: dateRange.to,
    sort: sortState.key,
    direction: sortState.direction,
    limit: 25,
  });
  const countsByStatus = ordersList.firstPage?.countsByStatus ?? {};
  const totalOrdersCount = Object.values(countsByStatus).reduce((sum, count) => sum + (count ?? 0), 0);

  const columns: DataTableColumn<OnlineOrder>[] = [
    {
      key: "order",
      header: "Order",
      sortKey: "createdAt",
      render: (order) => (
        <span className={styles.primaryCell}>
          <strong>{order.orderNumber}</strong>
          <span className={styles.muted}>{formatDateTimeForDisplay(order.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "buyer",
      header: "Customer",
      sortKey: "buyer",
      render: (order) => (
        <span className={styles.primaryCell}>
          <span>{order.buyer.name}</span>
          <span className={styles.muted}>
            @{order.buyer.username} · {order.shippingAddress.city}
          </span>
        </span>
      ),
    },
    { key: "items", header: "Items", sortKey: "items", align: "end", hideBelowTablet: true, render: countOrderItems },
    { key: "total", header: "Total", sortKey: "total", align: "end", render: (order) => formatMoney(order.total) },
    { key: "status", header: "Status", sortKey: "status", render: (order) => <StatusBadge tone={orderStatusPresentation[order.status].tone}>{orderStatusPresentation[order.status].label}</StatusBadge> },
    { key: "payment", header: "Payment", hideBelowTablet: true, render: (order) => <StatusBadge tone={paymentStatusPresentation[order.paymentStatus].tone}>{paymentStatusPresentation[order.paymentStatus].label}</StatusBadge> },
    { key: "delivery", header: "Delivery", hideBelowTablet: true, render: (order) => <StatusBadge tone={deliveryStatusPresentation[order.delivery.status].tone}>{deliveryStatusPresentation[order.delivery.status].label}</StatusBadge> },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Orders"
        description="The marketplace orders customers place in the Nantty app. Buyers pay into escrow; accept new orders, pack and ship them, and you are paid when the buyer confirms delivery. Changes here show in the app straight away."
      />
      <LinkTabs label="Order sections" tabs={ordersSectionTabs} />
      <div className={styles.chipRow} role="group" aria-label="Filter by status">
        <button type="button" className={styles.chip} aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          All
          {totalOrdersCount ? <span className={styles.chipCount}>{totalOrdersCount}</span> : null}
        </button>
        {orderStatusFilterOrder.map((status) => (
          <button key={status} type="button" className={styles.chip} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>
            {orderStatusPresentation[status].label}
            {countsByStatus[status] ? <span className={styles.chipCount}>{countsByStatus[status]}</span> : null}
          </button>
        ))}
      </div>
      <FilterBar>
        <SearchInput label="Search orders" placeholder="Order number, customer, city or payment reference" value={searchText} onValueChange={setSearchText} />
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
      </FilterBar>
      <Panel padded={false}>
        <DataTable
          caption="Orders from the Nantty app"
          columns={columns}
          rows={ordersList.items}
          readRowKey={(order) => order.id}
          isLoading={ordersList.isLoading}
          errorMessage={ordersList.errorMessage}
          onRetry={ordersList.reload}
          sortState={sortState}
          onSortChange={setSortState}
          onRowActivate={(order) => router.push(`/orders/${order.id}`)}
          hasMore={ordersList.hasMore}
          onLoadMore={ordersList.loadMore}
          isLoadingMore={ordersList.isLoadingMore}
          emptyState={
            <EmptyState
              iconName="shoppingCart24"
              title={statusFilter === "all" && !searchText ? "No orders in this period" : "No orders match these filters"}
              description="Orders appear here the moment a customer pays in the Nantty app. Try another status or a wider date range."
            />
          }
        />
      </Panel>
    </PageStack>
  );
}
