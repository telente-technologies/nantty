import type { Metadata } from "next";

import { StockAdjustmentsView } from "@/components/inventory/stockAdjustmentsView";

export const metadata: Metadata = { title: "Stock adjustments" };

function readSafeIdentifier(value: string | string[] | undefined): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

export default async function StockAdjustmentsPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  return <StockAdjustmentsView initialVariantId={readSafeIdentifier(parameters.variantId)} initialLocationId={readSafeIdentifier(parameters.locationId)} shouldOpenForm={parameters.new === "1"} />;
}
