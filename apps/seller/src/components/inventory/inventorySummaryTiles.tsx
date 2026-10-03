"use client";

import { StatTile } from "@/components/ui/feedback";
import { ResponsiveGrid } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { InventorySummary } from "@/types/productRequests.type";

export function InventorySummaryTiles({ summary, showReorder }: { readonly summary: InventorySummary | null; readonly showReorder: boolean }) {
  const { formatMoney, formatMoneyCompact } = useMoneyFormatter();
  if (!summary) return null;
  return (
    <ResponsiveGrid minimumColumnWidth={170}>
      <StatTile label="On hand" value={summary.onHand.toLocaleString()} detail={`${summary.skuCount.toLocaleString()} items tracked`} />
      <StatTile label="Available to sell" value={summary.available.toLocaleString()} detail="On hand minus reserved" tone="positive" />
      <StatTile label="Reserved for app orders" value={summary.reserved.toLocaleString()} detail="Held until shipped or cancelled" />
      <StatTile label="Low stock" value={summary.lowStockCount} detail="At or below the alert level" tone={summary.lowStockCount > 0 ? "caution" : "neutral"} />
      <StatTile label="Out of stock" value={summary.outOfStockCount} detail="Nothing available" tone={summary.outOfStockCount > 0 ? "negative" : "neutral"} />
      <StatTile label="Stock value at cost" value={formatMoneyCompact(summary.stockValue)} detail={`${formatMoney(summary.retailValue)} at selling price`} />
      {showReorder ? <StatTile label="Needs reorder" value={summary.needsReorderCount} detail="At or below the reorder point" tone={summary.needsReorderCount > 0 ? "caution" : "neutral"} /> : null}
    </ResponsiveGrid>
  );
}
