"use client";

import { LinkTabs } from "@/components/ui/navigationTabs";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";

export function InventoryTabs() {
  const { hasFeature } = usePlanFeatures();
  const proSuffix = hasFeature("advanced_inventory") ? "" : " · Pro";
  return (
    <LinkTabs
      label="Inventory sections"
      tabs={[
        { href: "/inventory", label: "Stock levels", exact: true },
        { href: "/inventory/adjustments", label: "Adjustments" },
        { href: "/inventory/movements", label: `Movements${proSuffix}` },
        { href: "/inventory/transfers", label: `Transfers${proSuffix}` },
        { href: "/inventory/reorder", label: `Reorder${proSuffix}` },
        { href: "/inventory/suppliers", label: `Suppliers${proSuffix}` },
        { href: "/inventory/locations", label: "Locations" },
      ]}
    />
  );
}
