"use client";

import { useState } from "react";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { buildInventoryLevelColumns } from "@/components/inventory/inventoryLevelColumns";
import { InventorySummaryTiles } from "@/components/inventory/inventorySummaryTiles";
import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type TableSortState } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { InventoryLevelRow, InventorySummary } from "@/types/productRequests.type";

import styles from "./inventoryViews.module.css";

export function LocationPicker({ value, onValueChange, label = "Location" }: { readonly value: string; readonly onValueChange: (locationId: string) => void; readonly label?: string }) {
  const { locations } = useStoreContext();
  return (
    <label className={styles.inlineSelect}>
      <span className="visuallyHidden">{label}</span>
      <select value={value} onChange={(event) => onValueChange(event.target.value)} aria-label={label}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>{location.name}{location.kind === "warehouse" ? " (warehouse)" : ""}</option>
        ))}
      </select>
    </label>
  );
}

type StockFilter = "" | "low" | "out" | "in";

export function InventoryLevelsView({ initialLowStockOnly = false }: { readonly initialLowStockOnly?: boolean }) {
  const { formatMoney } = useMoneyFormatter();
  const { hasFeature } = usePlanFeatures();
  const { selectedLocationId, locations } = useStoreContext();
  const [chosenLocationId, setChosenLocationId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>(initialLowStockOnly ? "low" : "");
  const [sortState, setSortState] = useState<TableSortState>({ key: "name", direction: "ascending" });
  const locationId = chosenLocationId || selectedLocationId || locations[0]?.id || "";
  const summaryQuery = useSellerQuery<InventorySummary>(locationId ? "/seller/inventory/summary" : null, { locationId });
  const levels = useCursorPagedList<InventoryLevelRow>("/seller/inventory/levels", { locationId, q: searchText, stock: stockFilter, sort: sortState.key, direction: sortState.direction, limit: 50 });
  const canPlanReorders = hasFeature("advanced_inventory");

  return (
    <PageStack>
      <PageHeader
        title="Inventory"
        description="One stock count per location. App orders reserve stock the moment customers pay, so you never sell the same item twice."
        actions={
          <span className={styles.headerActions}>
            <ButtonLink href="/inventory/transfers" iconName="repeat24">Transfer stock</ButtonLink>
            <FeaturePlanBadge feature="advanced_inventory" />
            <ButtonLink href="/inventory/adjustments?new=1" variant="primary" iconName="plus16">Adjust stock</ButtonLink>
          </span>
        }
      />
      <InventoryTabs />
      <InventorySummaryTiles summary={summaryQuery.data} showReorder={canPlanReorders} />
      <Panel padded={false}>
        <div className={styles.toolbarStack}>
          <FilterBar>
            <LocationPicker value={locationId} onValueChange={setChosenLocationId} />
            <SearchInput label="Search stock" placeholder="Search name or SKU" value={searchText} onValueChange={setSearchText} />
          </FilterBar>
          <SegmentedControl label="Stock filter" value={stockFilter} onValueChange={setStockFilter} options={[{ value: "", label: "All" }, { value: "low", label: "Low or out" }, { value: "out", label: "Out of stock" }, { value: "in", label: "Healthy" }]} />
        </div>
        <DataTable
          caption="Stock levels"
          columns={buildInventoryLevelColumns(formatMoney, canPlanReorders)}
          rows={levels.items}
          readRowKey={(row) => `${row.variantId}-${row.locationId}`}
          isLoading={levels.isLoading}
          errorMessage={levels.errorMessage}
          onRetry={levels.reload}
          sortState={sortState}
          onSortChange={setSortState}
          hasMore={levels.hasMore}
          onLoadMore={levels.loadMore}
          isLoadingMore={levels.isLoadingMore}
          emptyState={<EmptyState iconName="boxArrowDown24" title={stockFilter === "low" || stockFilter === "out" ? "Nothing is running low here" : "No stock matches"} description={stockFilter ? "Every item is above its low-stock alert." : "Try another search or location."} />}
        />
      </Panel>
    </PageStack>
  );
}
