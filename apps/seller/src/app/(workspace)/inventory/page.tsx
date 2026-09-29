import type { Metadata } from "next";

import { InventoryLevelsView } from "@/components/inventory/inventoryLevelsView";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return <InventoryLevelsView />;
}
