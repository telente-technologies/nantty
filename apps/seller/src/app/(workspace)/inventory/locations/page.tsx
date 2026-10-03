import type { Metadata } from "next";

import { InventoryLocationsView } from "@/components/inventory/inventoryLocationsView";

export const metadata: Metadata = { title: "Stock locations" };

export default function InventoryLocationsPage() {
  return <InventoryLocationsView />;
}
