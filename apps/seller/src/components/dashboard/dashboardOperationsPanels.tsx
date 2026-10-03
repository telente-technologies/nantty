"use client";

import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { DashboardSummary } from "@/types/dashboard.type";
import type { OnlineOrderStatus } from "@/types/order.type";

import styles from "./dashboard.module.css";

const orderStatusLabels: Record<OnlineOrderStatus, string> = { new: "New", processing: "Processing", ready: "Ready", shipped: "Shipped", delivered: "Delivered", completed: "Completed", disputed: "Disputed", cancelled: "Cancelled", returned: "Returned", refunded: "Refunded" };

export function DashboardOrdersByStatusPanel({ summary }: { readonly summary: DashboardSummary }) {
  const openOrdersCount = summary.ordersByStatus.filter((entry) => entry.status === "new" || entry.status === "processing" || entry.status === "ready").reduce((sum, entry) => sum + entry.count, 0);
  return (
    <Panel title="Orders by status" description={openOrdersCount > 0 ? `${openOrdersCount} to accept, pack or hand over` : "Nothing waiting on you"} actions={<ButtonLink href="/orders" size="small">View orders</ButtonLink>}>
      <div className={styles.statusGrid}>
        {summary.ordersByStatus.map((entry) => (
          <Link key={entry.status} href={`/orders?status=${entry.status}`} className={styles.statusCell}>
            <span className={styles.statusCount}>{entry.count}</span>
            <span className={styles.statusLabel}>{orderStatusLabels[entry.status]}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function DashboardTopProductsPanel({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney } = useMoneyFormatter();
  const highestRevenueMinor = Math.max(1, ...summary.topProducts.map((product) => product.revenue.amountMinor));
  return (
    <Panel title="Top products" description="By revenue, last 30 days">
      {summary.topProducts.length === 0 ? (
        <EmptyState iconName="tag24" title="No sales yet" description="Your best sellers show up here." />
      ) : (
        <ol className={styles.listRows}>
          {summary.topProducts.map((product) => (
            <li key={product.productId} className={styles.listRow}>
              {product.imageUrl ? <img src={product.imageUrl} alt="" className={styles.thumbnail} loading="lazy" /> : <span className={styles.thumbnailFallback} aria-hidden="true">{product.name.slice(0, 1)}</span>}
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{product.name}</span>
                <span className={styles.rowMeta}>{product.unitsSold} sold</span>
                <span className={styles.shareBar} style={{ width: `${Math.max(4, (product.revenue.amountMinor / highestRevenueMinor) * 100)}%` }} aria-hidden="true" />
              </span>
              <span className={styles.rowValue}>{formatMoney(product.revenue)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function DashboardLowStockPanel({ summary }: { readonly summary: DashboardSummary }) {
  const { locations } = useStoreContext();
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  return (
    <Panel title="Low stock" description="At or below the reorder level" actions={<ButtonLink href="/inventory?lowStockOnly=true" size="small">Open inventory</ButtonLink>}>
      {summary.lowStockAlerts.length === 0 ? (
        <EmptyState iconName="boxArrowDown24" title="Stock looks healthy" description="Nothing is below its low-stock level." />
      ) : (
        <ul className={styles.listRows}>
          {summary.lowStockAlerts.map((alert) => (
            <li key={`${alert.variantId}-${alert.locationId}`} className={styles.listRow}>
              <span className={styles.rowMain}>
                <Link href={`/products/${alert.productId}`} className={styles.rowTitle}>
                  {alert.productName}
                  {alert.variantTitle !== "Default" ? ` · ${alert.variantTitle}` : ""}
                </Link>
                <span className={styles.rowMeta}>
                  {alert.sku} · {locationNameById.get(alert.locationId) ?? alert.locationId}
                </span>
              </span>
              <StatusBadge tone={alert.available === 0 ? "error" : "caution"}>{alert.available === 0 ? "Out of stock" : `${alert.available} left`}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
