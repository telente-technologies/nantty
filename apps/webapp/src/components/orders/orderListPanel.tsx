"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ordersService } from "@/services/orders.service";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import type { OrderStatus } from "@/types";

import styles from "./orderListPanel.module.css";

const statusTone: Record<OrderStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  pending: "warning",
  paid: "brand",
  new: "brand",
  processing: "brand",
  ready: "brand",
  shipped: "brand",
  delivered: "success",
  completed: "success",
  cancelled: "error",
  returned: "error",
  refunded: "error",
  disputed: "error",
};

const statusFilters: readonly { readonly value: OrderStatus | null; readonly label: string }[] = [
  { value: null, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function OrderListSkeleton() {
  return (
    <ul className={styles.list} role="status" aria-label="Loading orders">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className={styles.card} aria-hidden="true">
          <Skeleton width="45%" height={14} />
          <Skeleton width="30%" height={14} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="25%" height={16} />
        </li>
      ))}
    </ul>
  );
}

export function OrderListPanel({ activeOrderId }: { readonly activeOrderId: string | null }) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const ordersQuery = useInfiniteQuery({
    queryKey: ["orders", status],
    queryFn: ({ pageParam }) => ordersService.fetchMyOrdersPage(pageParam, status),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: false,
  });
  const orders = ordersQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your orders</h1>

      <div className={styles.filters} role="group" aria-label="Filter orders by status">
        {statusFilters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className={[styles.filter, status === filter.value ? styles.filterActive : ""].filter(Boolean).join(" ")}
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <OrderListSkeleton />
      ) : ordersQuery.isError ? (
        <ErrorState description="We couldn't load your orders." error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState kind="orders" title="No orders yet" description="When you place an order it will show up here with live escrow status." action={
            <Link href="/mart" className={styles.cta}>
              Start shopping
            </Link>
          } />
      ) : (
        <ul className={styles.list}>
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className={[styles.card, activeOrderId === order.id ? styles.cardActive : ""].join(" ")}
                aria-current={activeOrderId === order.id ? "page" : undefined}
              >
                <div className={styles.cardTop}>
                  <span className={styles.reference}>{order.reference}</span>
                  <Badge tone={statusTone[order.status]}>{order.status}</Badge>
                </div>
                <div className={styles.cardStore}>{order.store.name}</div>
                <div className={styles.cardItems}>
                  {order.items.slice(0, 3).map((item) => (
                    <span key={item.id} className={styles.cardItem}>
                      {item.product.name} × {item.quantity}
                    </span>
                  ))}
                  {order.items.length > 3 ? <span className={styles.cardMore}>+{order.items.length - 3} more</span> : null}
                </div>
                <div className={styles.cardBottom}>
                  <span className={styles.total}>{formatMoneyForDisplay(order.total)}</span>
                  <span className={styles.time}>{formatTimeSincePosted(order.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {ordersQuery.isFetchNextPageError ? (
        <ErrorState description="We couldn't load older orders." error={ordersQuery.error} onRetry={() => void ordersQuery.fetchNextPage()} />
      ) : ordersQuery.isFetchingNextPage ? (
        <OrderListSkeleton />
      ) : ordersQuery.hasNextPage ? (
        <Button variant="secondary" onClick={() => void ordersQuery.fetchNextPage()}>Load older orders</Button>
      ) : null}
    </div>
  );
}
