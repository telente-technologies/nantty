"use client";

import Link from "next/link";

import { PlanLockedNotice } from "@/components/billing/planGate";
import { InventoryTabs } from "@/components/inventory/inventoryTabs";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { CursorPage } from "@/types/pagination.type";
import type { InventoryLocationSummary } from "@/types/productRequests.type";

import styles from "./inventoryViews.module.css";

export function InventoryLocationsView() {
  const { can } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const { hasFeature, limits } = usePlanFeatures();
  const locationsQuery = useSellerQuery<CursorPage<InventoryLocationSummary>>("/seller/inventory/locations");
  const locations = locationsQuery.data?.data ?? null;
  const activeCount = (locations ?? []).filter((location) => location.active).length;
  const canAddAnotherLocation = hasFeature("multiple_warehouses") && activeCount < limits.maxLocations;

  const columns: DataTableColumn<InventoryLocationSummary>[] = [
    {
      key: "name",
      header: "Location",
      render: (location) => (
        <span className={styles.itemCell}>
          <span>
            <strong>{location.name}</strong>
            <small>{location.kind === "warehouse" ? "Warehouse" : "Shop or pickup point"} · {location.city}</small>
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", hideBelowTablet: true, render: (location) => (location.active ? (location.isDefault ? <StatusBadge tone="info">Default</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>) : <StatusBadge>Inactive</StatusBadge>) },
    { key: "items", header: "Items", align: "end", hideBelowTablet: true, render: (location) => location.skuCount },
    { key: "onHand", header: "On hand", align: "end", render: (location) => location.onHand.toLocaleString() },
    { key: "reserved", header: "Reserved", align: "end", hideBelowTablet: true, render: (location) => location.reserved },
    { key: "low", header: "Low or out", align: "end", render: (location) => (location.lowStockCount > 0 ? <Link href={`/inventory?lowStockOnly=true`}>{location.lowStockCount}</Link> : 0) },
    { key: "value", header: "Value (cost)", align: "end", render: (location) => formatMoney(location.stockValue) },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Stock locations"
        description={`Where your stock lives. App orders ship from any location that has stock. ${activeCount} of ${limits.maxLocations} location${limits.maxLocations === 1 ? "" : "s"} on your plan in use.`}
        actions={can("settings:manage") && canAddAnotherLocation ? <ButtonLink href="/settings/locations" variant="primary" iconName="plus16">Add location</ButtonLink> : null}
      />
      <InventoryTabs />
      {!hasFeature("multiple_warehouses") ? <PlanLockedNotice feature="multiple_warehouses" compact description="Free includes one location. Upgrade to Pro to hold stock in up to 3 shops or warehouses and move it between them." /> : null}
      <Panel padded={false}>
        <DataTable
          caption="Stock by location"
          columns={columns}
          rows={locations}
          readRowKey={(location) => location.locationId}
          isLoading={locationsQuery.isLoading}
          errorMessage={locationsQuery.errorMessage}
          onRetry={locationsQuery.reload}
          emptyState={<EmptyState iconName="mapPin24" title="No locations yet" description="Add your shop or warehouse in Settings › Locations." />}
        />
      </Panel>
    </PageStack>
  );
}
