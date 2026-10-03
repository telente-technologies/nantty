"use client";

import Link from "next/link";

import { Sparkline } from "@/components/charts/sparkline";
import { describeChangeBetweenNumbers } from "@/components/dashboard/dashboardSalesPanels";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StatTile } from "@/components/ui/feedback";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { DashboardSummary } from "@/types/dashboard.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./dashboard.module.css";

export function DashboardInsightTiles({ summary }: { readonly summary: DashboardSummary }) {
  const { can } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const { traffic, customerGrowth, catalog, balances } = summary;
  const viewsChange = describeChangeBetweenNumbers(traffic.storeViews, traffic.previousStoreViews, "the 30 days before");
  const conversionChange = describeChangeBetweenNumbers(traffic.conversionRateBasisPoints, traffic.previousConversionRateBasisPoints, "the 30 days before");
  const customerChange = describeChangeBetweenNumbers(customerGrowth.newCustomers, customerGrowth.previousNewCustomers, "the 30 days before");
  const numberFormatter = new Intl.NumberFormat("en-NG");
  return (
    <div className={styles.kpiRow}>
      {can("wallet:view") && balances ? (
        <>
          <StatTile label="Available balance" value={formatMoney(balances.available)} detail="Ready to withdraw" tone="positive" />
          <StatTile label="Pending settlement" value={formatMoney({ amountMinor: balances.escrow.amountMinor + balances.pending.amountMinor, currency: balances.escrow.currency })} detail={`${formatMoney(balances.escrow)} in escrow · ${formatMoney(balances.pending)} clearing`} />
        </>
      ) : null}
      <Link href="/products" className={styles.tileLink}>
        <StatTile label="Products" value={numberFormatter.format(catalog.activeProducts)} detail={`${catalog.draftProducts} drafts · ${catalog.totalProducts} in total`} />
      </Link>
      <Link href="/inventory?lowStockOnly=true" className={styles.tileLink}>
        <StatTile label="Low stock" value={numberFormatter.format(catalog.lowStockCount)} detail={catalog.outOfStockCount > 0 ? `${catalog.outOfStockCount} out of stock` : "Nothing sold out"} tone={catalog.outOfStockCount > 0 ? "negative" : catalog.lowStockCount > 0 ? "caution" : "neutral"} />
      </Link>
      <div className={styles.tileWithSpark}>
        <StatTile label="Store views · 30 days" value={numberFormatter.format(traffic.storeViews)} detail={viewsChange.text} tone={viewsChange.tone} />
        <span className={styles.spark}>
          <Sparkline values={traffic.dailyStoreViews} label="Daily store views for the last 30 days" />
        </span>
      </div>
      <StatTile label="Conversion rate" value={formatBasisPointsAsPercent(traffic.conversionRateBasisPoints)} detail={`${conversionChange.text} · ${numberFormatter.format(traffic.visitors)} visitors`} tone={conversionChange.tone} />
      <div className={styles.tileWithSpark}>
        <StatTile label="New customers · 30 days" value={numberFormatter.format(customerGrowth.newCustomers)} detail={`${customerChange.text} · ${customerGrowth.returningCustomers} returning`} tone={customerChange.tone} />
        <span className={styles.spark}>
          <Sparkline values={customerGrowth.dailyNewCustomers} label="New customers per day for the last 30 days" colorVariable="--success" />
        </span>
      </div>
    </div>
  );
}
