"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/components/providers/sessionProvider";
import { InlineLink } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { actingProfileService } from "@/services/actingProfile.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";
import type { SellerDashboardPeriod } from "@/types/account.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { SELLER_DASHBOARD_PERIODS } from "@/utils/sellerDashboardPeriods.util";
import { SellerSalesSeriesChart } from "@/components/seller/sellerSalesSeriesChart";

import styles from "./page.module.css";

export default function SellerDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<SellerDashboardPeriod>("today");
  const myStoreId = useSession().viewer?.storeId ?? null;
  const dashboard = useQuery({ queryKey: ["seller", "dashboard", period], queryFn: () => sellerService.fetchSellerDashboard(period) });
  const application = useQuery({ queryKey: ["seller", "application"], queryFn: () => sellerService.fetchMySellerApplication(), retry: false });
  const postAsStore = useMutation({
    mutationFn: () => {
      if (!myStoreId) throw new Error("No store is linked to this account.");
      return actingProfileService.switchTo(myStoreId);
    },
    onSuccess: async (profile) => {
      await queryClient.cancelQueries({ queryKey: ["users", "me", "acting-profile"] });
      queryClient.setQueryData(["users", "me", "acting-profile"], profile);
      router.push("/post/new");
    },
  });
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
        {SELLER_DASHBOARD_PERIODS.map((option) => (
          <button key={option.key} type="button" className={[styles.chip, period === option.key ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>
            {option.key === "live" ? <span className={styles.liveDot} aria-hidden="true" /> : null}
            {option.label}
          </button>
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
      <SellerSalesSeriesChart
        series={data.series}
        totalSales={data.totalSales}
        periodLabel={SELLER_DASHBOARD_PERIODS.find((option) => option.key === period)?.label ?? period}
      />
      <nav className={styles.links} aria-label="Seller sections">
        <Link className={styles.linkButton} href="/seller/products">Products</Link>
        <Link className={styles.linkButton} href="/seller/orders">Orders</Link>
        <Link className={styles.linkButton} href="/seller/products/new">Add product</Link>
        {myStoreId ? (
          <button className={styles.primary} type="button" disabled={postAsStore.isPending} aria-busy={postAsStore.isPending} onClick={() => postAsStore.mutate()}>
            {postAsStore.isPending ? "Switching to store…" : "Post as store"}
          </button>
        ) : null}
        {myStoreId ? <Link className={styles.linkButton} href={`/ads/create?type=store&target=${encodeURIComponent(myStoreId)}`}>Promote store</Link> : null}
        <Link className={styles.linkButton} href="/ads">Ads</Link>
        <Link className={styles.linkButton} href="/seller/apply">Seller application</Link>
        <Link className={styles.linkButton} href="/wallet/payouts">Payouts</Link>
      </nav>
      {postAsStore.isPending ? <p className={styles.note} role="status">Switching to your store profile…</p> : null}
      {postAsStore.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(postAsStore.error)}</p> : null}
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
