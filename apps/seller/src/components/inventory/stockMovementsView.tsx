"use client";

import Link from "next/link";
import { useState } from "react";

import { PlanGate } from "@/components/billing/planGate";
import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, SearchInput, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { InventoryMovement, InventoryMovementKind } from "@/types/catalog.type";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./inventoryViews.module.css";

const movementKindPresentation: Record<InventoryMovementKind, { readonly label: string; readonly tone: StatusTone }> = {
  adjustment: { label: "Adjustment", tone: "neutral" },
  transfer_out: { label: "Transfer out", tone: "info" },
  transfer_in: { label: "Transfer in", tone: "info" },
  order_reserved: { label: "Reserved for order", tone: "caution" },
  order_shipped: { label: "Shipped to buyer", tone: "highlight" },
  order_returned: { label: "Returned", tone: "success" },
};

const movementColumns = (locationName: (locationId: string) => string): DataTableColumn<InventoryMovement>[] => [
  { key: "when", header: "When", render: (movement) => formatDateTimeForDisplay(movement.createdAt) },
  { key: "item", header: "Item", render: (movement) => <span className={styles.itemCell}><span><Link href={`/products/${movement.productId}`}>{movement.productName}</Link><small>{movement.variantTitle === "Default" ? movement.sku : `${movement.variantTitle} · ${movement.sku}`}</small></span></span> },
  { key: "kind", header: "Type", render: (movement) => <StatusBadge tone={movementKindPresentation[movement.kind].tone}>{movementKindPresentation[movement.kind].label}</StatusBadge> },
  { key: "change", header: "Change", align: "end", render: (movement) => <span className={`${styles.delta} ${movement.quantityDelta > 0 ? styles.deltaUp : styles.deltaDown}`}>{movement.quantityDelta > 0 ? `+${movement.quantityDelta}` : movement.quantityDelta}</span> },
  { key: "location", header: "Location", hideBelowTablet: true, render: (movement) => locationName(movement.locationId) },
  { key: "reference", header: "Reference", hideBelowTablet: true, render: (movement) => <span className={styles.itemCell}><span>{movement.reference}<small>{movement.note ?? ""}</small></span></span> },
  { key: "by", header: "By", hideBelowTablet: true, render: (movement) => movement.actorName },
];

function StockMovementsTable() {
  const { locations } = useStoreContext();
  const [locationId, setLocationId] = useState("");
  const [kind, setKind] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(90));
  const movements = useCursorPagedList<InventoryMovement>("/seller/inventory/movements", { locationId, kind, q: searchText, from: dateRange.from, to: dateRange.to, limit: 25 });
  const locationName = (candidateId: string) => locations.find((location) => location.id === candidateId)?.name ?? candidateId;

  return (
        <Panel padded={false}>
          <div className={styles.toolbarStack}>
            <FilterBar>
              <label className={styles.inlineSelect}>
                <span className="visuallyHidden">Location</span>
                <select value={locationId} onChange={(event) => setLocationId(event.target.value)} aria-label="Location">
                  <option value="">All locations</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
              <label className={styles.inlineSelect}>
                <span className="visuallyHidden">Movement type</span>
                <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Movement type">
                  <option value="">All types</option>
                  {(Object.keys(movementKindPresentation) as InventoryMovementKind[]).map((movementKind) => <option key={movementKind} value={movementKind}>{movementKindPresentation[movementKind].label}</option>)}
                </select>
              </label>
              <SearchInput label="Search movements" placeholder="Product, SKU or reference" value={searchText} onValueChange={setSearchText} />
            </FilterBar>
            <DateRangeControl value={dateRange} onValueChange={setDateRange} />
          </div>
          <DataTable
            caption="Stock movements"
            columns={movementColumns(locationName)}
            rows={movements.items}
            readRowKey={(movement) => movement.id}
            isLoading={movements.isLoading}
            errorMessage={movements.errorMessage}
            onRetry={movements.reload}
            hasMore={movements.hasMore}
            onLoadMore={movements.loadMore}
            isLoadingMore={movements.isLoadingMore}
            emptyState={<EmptyState iconName="repeat24" title="No movements in this period" description="Try a wider date range or another location." />}
          />
        </Panel>
  );
}

export function StockMovementsView() {
  return (
    <PageStack>
      <PageHeader title="Stock movements" description="Every unit in and out: deliveries, counts, damage, transfers, app orders and returns — so you can explain any stock number." />
      <InventoryTabs />
      <PlanGate feature="advanced_inventory" description="See a full history of every stock change, filter it by product, location and date, and trace any difference.">
        <StockMovementsTable />
      </PlanGate>
    </PageStack>
  );
}
