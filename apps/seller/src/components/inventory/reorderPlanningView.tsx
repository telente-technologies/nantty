"use client";

import Link from "next/link";
import { useState } from "react";

import { PlanGate } from "@/components/billing/planGate";
import { LocationPicker } from "@/components/inventory/inventoryLevelsView";
import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { ReorderLevelDialog } from "@/components/inventory/reorderLevelDialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, StatTile } from "@/components/ui/feedback";
import { FilterBar } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { ReorderSuggestionRow } from "@/types/productRequests.type";
import { convertRowsToCsvText, triggerBrowserDownload } from "@/utils/csvFile.util";

import styles from "./inventoryViews.module.css";

function ReorderPlanningTable() {
  const { formatMoney } = useMoneyFormatter();
  const { selectedLocationId, locations } = useStoreContext();
  const [chosenLocationId, setChosenLocationId] = useState("");
  const [editingRow, setEditingRow] = useState<ReorderSuggestionRow | null>(null);
  const locationId = chosenLocationId || selectedLocationId || locations[0]?.id || "";
  const suggestions = useCursorPagedList<ReorderSuggestionRow>("/seller/inventory/reorder", { locationId, limit: 50 });
  const rows = suggestions.items ?? [];
  const estimatedTotalMinor = rows.reduce((sum, row) => sum + (row.estimatedCost?.amountMinor ?? 0), 0);
  const currency = rows.find((row) => row.estimatedCost)?.estimatedCost?.currency;

  function downloadPurchaseListCsv() {
    const csvRows = rows.map((row) => [row.supplier?.name ?? "No supplier", row.productName, row.variantTitle, row.sku, String(row.available), String(row.suggestedQuantity)]);
    triggerBrowserDownload(`reorder-list-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([convertRowsToCsvText(["supplier", "product", "variant", "sku", "available", "order_quantity"], csvRows)], { type: "text/csv;charset=utf-8" }));
  }

  const columns: DataTableColumn<ReorderSuggestionRow>[] = [
    { key: "item", header: "Item", render: (row) => <span className={styles.itemCell}><span><Link href={`/products/${row.productId}`}>{row.productName}</Link><small>{row.variantTitle === "Default" ? row.sku : `${row.variantTitle} · ${row.sku}`}</small></span></span> },
    { key: "available", header: "Available", align: "end", render: (row) => (row.available <= 0 ? <StatusBadge tone="error">{row.available}</StatusBadge> : <StatusBadge tone="caution">{row.available}</StatusBadge>) },
    { key: "point", header: "Reorder at", align: "end", hideBelowTablet: true, render: (row) => row.reorderPoint },
    { key: "suggested", header: "Order", align: "end", render: (row) => <strong>{row.suggestedQuantity}</strong> },
    { key: "supplier", header: "Supplier", hideBelowTablet: true, render: (row) => (row.supplier ? <span className={styles.itemCell}><span>{row.supplier.name}<small>{row.supplier.leadTimeDays} day lead time</small></span></span> : <Link href={`/products/${row.productId}`}>Add a supplier</Link>) },
    { key: "cost", header: "Est. cost", align: "end", hideBelowTablet: true, render: (row) => formatMoney(row.estimatedCost) },
    { key: "actions", header: <span className="visuallyHidden">Actions</span>, align: "end", render: (row) => <Button size="small" variant="ghost" onClick={() => setEditingRow(row)}>Edit levels</Button> },
  ];

  return (
    <>
      <ResponsiveGrid minimumColumnWidth={180}>
        <StatTile label="Items to reorder" value={rows.length} tone={rows.length > 0 ? "caution" : "neutral"} />
        <StatTile label="Out of stock" value={rows.filter((row) => row.available <= 0).length} tone="negative" />
        <StatTile label="Estimated purchase cost" value={currency ? formatMoney({ amountMinor: estimatedTotalMinor, currency }) : "—"} detail="At your recorded cost prices" />
      </ResponsiveGrid>
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <FilterBar>
            <LocationPicker value={locationId} onValueChange={setChosenLocationId} />
            <Button size="small" iconName="boxArrowDown24" disabled={rows.length === 0} onClick={downloadPurchaseListCsv}>Download purchase list</Button>
          </FilterBar>
        </div>
        <DataTable
          caption="Items that need reordering"
          columns={columns}
          rows={suggestions.items}
          readRowKey={(row) => row.variantId}
          isLoading={suggestions.isLoading}
          errorMessage={suggestions.errorMessage}
          onRetry={suggestions.reload}
          hasMore={suggestions.hasMore}
          onLoadMore={suggestions.loadMore}
          isLoadingMore={suggestions.isLoadingMore}
          emptyState={<EmptyState iconName="boxArrowDown24" title="Nothing needs reordering" description="Every item at this location is above its reorder point." />}
        />
      </Panel>
      {editingRow ? <ReorderLevelDialog key={editingRow.variantId} row={editingRow} onClose={() => setEditingRow(null)} onSaved={() => { setEditingRow(null); suggestions.reload(); }} /> : null}
    </>
  );
}

export function ReorderPlanningView() {
  return (
    <PageStack>
      <PageHeader title="Reorder planning" description="Items at or below their reorder point, with how many to order and from which supplier." />
      <InventoryTabs />
      <PlanGate feature="advanced_inventory" description="Set reorder points per item, see what to buy and from whom, and download a purchase list for your suppliers.">
        <ReorderPlanningTable />
      </PlanGate>
    </PageStack>
  );
}
