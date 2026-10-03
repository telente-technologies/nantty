import Link from "next/link";

import type { DataTableColumn } from "@/components/ui/dataTable";
import { StatusBadge } from "@/components/ui/statusBadge";
import type { Money } from "@/types/money.type";
import type { InventoryLevelRow } from "@/types/productRequests.type";

import styles from "./inventoryViews.module.css";

function renderAvailableCell(row: InventoryLevelRow) {
  if (row.available <= 0) return <StatusBadge tone="error">{row.available} · out</StatusBadge>;
  if (row.available <= row.lowStockThreshold) return <StatusBadge tone="caution">{row.available} · low</StatusBadge>;
  return <strong>{row.available}</strong>;
}

export function buildInventoryLevelColumns(formatMoney: (money: Money | null | undefined) => string, showReorderColumn: boolean): DataTableColumn<InventoryLevelRow>[] {
  return [
    {
      key: "item",
      header: "Item",
      sortKey: "name",
      render: (row) => (
        <div className={styles.itemCell}>
          {row.imageUrl ? <img src={row.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{row.productName.slice(0, 2).toUpperCase()}</span>}
          <span>
            <Link href={`/products/${row.productId}`}>{row.productName}</Link>
            <small>{row.variantTitle === "Default" ? row.sku : `${row.variantTitle} · ${row.sku}`}</small>
          </span>
        </div>
      ),
    },
    { key: "onHand", header: "On hand", align: "end", sortKey: "onHand", render: (row) => row.onHand },
    { key: "reserved", header: "Reserved", align: "end", sortKey: "reserved", hideBelowTablet: true, render: (row) => (row.reserved > 0 ? row.reserved : <span className={styles.muted}>0</span>) },
    { key: "available", header: "Available", align: "end", sortKey: "available", render: renderAvailableCell },
    { key: "threshold", header: "Alert at", align: "end", hideBelowTablet: true, render: (row) => row.lowStockThreshold },
    ...(showReorderColumn ? [{ key: "reorder", header: "Reorder at", align: "end" as const, hideBelowTablet: true, render: (row: InventoryLevelRow) => `${row.reorderPoint} (reorder ${row.reorderQuantity})` }] : []),
    { key: "value", header: "Value (cost)", align: "end", sortKey: "value", hideBelowTablet: true, render: (row) => formatMoney(row.stockValue) },
    { key: "actions", header: <span className="visuallyHidden">Actions</span>, align: "end", render: (row) => <Link href={`/inventory/adjustments?variantId=${encodeURIComponent(row.variantId)}&locationId=${encodeURIComponent(row.locationId)}&new=1`}>Adjust</Link> },
  ];
}
