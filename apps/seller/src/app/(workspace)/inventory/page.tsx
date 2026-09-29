import type { Metadata } from "next";

import { InventoryLevelsView } from "@/components/inventory/inventoryLevelsView";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lowStockOnly } = await searchParams;
  return <InventoryLevelsView initialLowStockOnly={lowStockOnly === "true"} />;
}
