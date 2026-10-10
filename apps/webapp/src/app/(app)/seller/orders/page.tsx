"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { sellerService } from "@/services/seller.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../page.module.css";

export default function SellerOrdersPage() {
  const orders = useQuery({ queryKey: ["seller", "orders"], queryFn: () => sellerService.listMyStoreOrders() });
  if (orders.isLoading) return <ListRowsSkeleton label="Loading orders" rows={6} />;
  if (orders.isError || !orders.data) return <ErrorState description="We couldn't load your orders." action={<RetryButton onRetry={() => orders.refetch()} />} />;
  if (orders.data.length === 0) return <EmptyState title="No orders yet" description="New orders from your store will show up here." />;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Seller orders</h1>
      <ul className={styles.list}>
        {orders.data.map((order) => (
          <li key={order.id} className={styles.row}>
            <Link className={styles.rowMain} href={`/seller/orders/${order.id}`}>
              <span className={styles.rowTitle}>{order.reference}</span>
              <span className={styles.rowMeta}>{order.status} · {new Date(order.createdAt).toLocaleDateString()}</span>
            </Link>
            <span className={styles.amount}>{formatMoneyForDisplay(order.total)}</span>
            <span className={styles.pill}>{order.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
