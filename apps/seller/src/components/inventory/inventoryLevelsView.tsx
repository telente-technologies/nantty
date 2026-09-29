"use client";

import Link from "next/link";
import { useState } from "react";

import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { CheckboxField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { InventoryLevelRow } from "@/types/productRequests.type";

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

export function InventoryLevelsView() {
  const { formatMoney } = useMoneyFormatter();
  const { selectedLocationId, locations } = useStoreContext();
  const [chosenLocationId, setChosenLocationId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const locationId = chosenLocationId || selectedLocationId || locations[0]?.id || "";
  const levels = useCursorPagedList<InventoryLevelRow>("/seller/inventory/levels", { locationId, q: searchText, lowStockOnly: lowStockOnly ? "true" : undefined, limit: 50 });

  const columns: DataTableColumn<InventoryLevelRow>[] = [
    {
      key: "item",
      header: "Item",
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
    { key: "onHand", header: "On hand", align: "end", render: (row) => <strong>{row.onHand}</strong> },
    { key: "reserved", header: "Reserved online", align: "end", hideBelowTablet: true, render: (row) => row.reserved },
    { key: "available", header: "Available", align: "end", render: (row) => (row.available <= 0 ? <StatusBadge tone="error">{row.available}</StatusBadge> : row.onHand <= row.lowStockThreshold ? <StatusBadge tone="caution">{row.available}</StatusBadge> : row.available) },
    { key: "threshold", header: "Alert at", align: "end", hideBelowTablet: true, render: (row) => row.lowStockThreshold },
    { key: "value", header: "Stock value (cost)", align: "end", hideBelowTablet: true, render: (row) => formatMoney(row.stockValue) },
    { key: "actions", header: <span className="visuallyHidden">Actions</span>, align: "end", render: (row) => <Link href={`/inventory/adjustments?variantId=${encodeURIComponent(row.variantId)}&locationId=${encodeURIComponent(row.locationId)}`}>Adjust</Link> },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Inventory"
        description="One stock count per location, shared by the register and the marketplace. Reserved units are held for paid online orders."
        actions={<><ButtonLink href="/inventory/transfers" iconName="repeat24">Transfer stock</ButtonLink><ButtonLink href="/inventory/adjustments?new=1" variant="primary" iconName="plus16">Adjust stock</ButtonLink></>}
      />
      <InventoryTabs />
      <Panel padded={false}>
        <div className={styles.toolbar}>
          <FilterBar>
            <LocationPicker value={locationId} onValueChange={setChosenLocationId} />
            <SearchInput label="Search stock" placeholder="Search name or SKU" value={searchText} onValueChange={setSearchText} />
            <CheckboxField label="Low or out of stock only" checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          </FilterBar>
        </div>
        {levels.errorMessage ? <div className={styles.toolbar}><Callout tone="error">{levels.errorMessage}</Callout></div> : null}
        <DataTable
          caption="Stock levels"
          columns={columns}
          rows={levels.items}
          readRowKey={(row) => `${row.variantId}-${row.locationId}`}
          isLoading={levels.isLoading}
          hasMore={levels.hasMore}
          onLoadMore={levels.loadMore}
          isLoadingMore={levels.isLoadingMore}
          emptyState={<EmptyState iconName="boxArrowDown24" title={lowStockOnly ? "Nothing is running low here" : "No stock matches"} description={lowStockOnly ? "Every item is above its low-stock alert." : "Try another search or location."} />}
        />
      </Panel>
    </PageStack>
  );
}
