"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { InlineLink } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { sellerService } from "@/services/seller.service";
import type { SellerDashboardPeriod } from "@/types/account.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

const PERIODS: readonly { readonly key: SellerDashboardPeriod; readonly label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All time" },
];

export default function SellerDashboardPage() {
  const [period, setPeriod] = useState<SellerDashboardPeriod>("today");
  const dashboard = useQuery({ queryKey: ["seller", "dashboard", period], queryFn: () => sellerService.fetchSellerDashboard(period) });
  const application = useQuery({ queryKey: ["seller", "application"], queryFn: () => sellerService.fetchMySellerApplication(), retry: false });
  if (dashboard.isLoading) return <ListRowsSkeleton label="Loading seller dashboard" rows={6} />;
  if (dashboard.isError || !dashboard.data) return <ErrorState description="We couldn't load your seller dashboard." error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  const data = dashboard.data;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Seller dashboard</h1>
      {application.data && application.data.status !== "approved" ? (
        <p className={styles.note}>Application status: {application.data.status}{application.data.rejectionReason ? ` — ${application.data.rejectionReason}` : ""}</p>
      ) : null}
      <div className={styles.chips} role="group" aria-label="Dashboard period">
        {PERIODS.map((option) => (
          <button key={option.key} type="button" className={[styles.chip, period === option.key ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>{option.label}</button>
        ))}
      </div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>Total sales</span>
          <span className={styles.value}>{formatMoneyForDisplay(data.totalSales)}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Orders</span>
          <span className={styles.value}>{data.orders.toLocaleString()}</span>
        </div>
      </div>
      <nav className={styles.links} aria-label="Seller sections">
        <Link className={styles.linkButton} href="/seller/products">Products</Link>
        <Link className={styles.linkButton} href="/seller/orders">Orders</Link>
        <Link className={styles.linkButton} href="/seller/products/new">Add product</Link>
        <Link className={styles.linkButton} href="/seller/apply">Seller application</Link>
        <Link className={styles.linkButton} href="/wallet/payouts">Payouts</Link>
      </nav>
      <section className={styles.section} aria-label="Recent orders">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Recent orders</h2>
          <InlineLink href="/seller/orders">All orders</InlineLink>
        </div>
        {data.recentOrders.length === 0 ? (
          <EmptyState kind="orders" title="No orders yet" description="New orders from your store will show up here." />
        ) : (
          <ul className={styles.list}>
            {data.recentOrders.slice(0, 5).map((order) => (
              <li key={order.id} className={styles.row}>
                <Link className={styles.rowMain} href={`/seller/orders/${order.id}`}>
                  <span className={styles.rowTitle}>{order.reference}</span>
                  <span className={styles.rowMeta}>{order.status} · {new Date(order.createdAt).toLocaleDateString()}</span>
                </Link>
                <span className={styles.amount}>{formatMoneyForDisplay(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section} aria-label="Inventory">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Inventory</h2>
          <InlineLink href="/seller/products">Manage products</InlineLink>
        </div>
        {data.inventory.length === 0 ? (
          <p className={styles.note}>No products yet. Add your first product to start selling.</p>
        ) : (
          <ul className={styles.list}>
            {data.inventory.slice(0, 5).map((product) => (
              <li key={product.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{product.name}</span>
                  <span className={styles.rowMeta}>Stock {product.stock ?? "—"}</span>
                </span>
                <span className={styles.amount}>{formatMoneyForDisplay(product.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
