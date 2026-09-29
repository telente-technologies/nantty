import type { PosSale } from "@/types/pos.type";
import type { PosCatalogSnapshot } from "@/types/posExtra.type";

function sumSoldQuantityByVariantAtLocation(sales: readonly PosSale[], locationId: string): Map<string, number> {
  const soldQuantityByVariantId = new Map<string, number>();
  for (const sale of sales) {
    if (sale.locationId !== locationId) continue;
    for (const line of sale.lines) soldQuantityByVariantId.set(line.variantId, (soldQuantityByVariantId.get(line.variantId) ?? 0) + line.quantity);
  }
  return soldQuantityByVariantId;
}

export function subtractUnsyncedSalesFromCatalogStock(snapshot: PosCatalogSnapshot, unsyncedSales: readonly PosSale[]): PosCatalogSnapshot {
  const soldQuantityByVariantId = sumSoldQuantityByVariantAtLocation(unsyncedSales, snapshot.locationId);
  if (soldQuantityByVariantId.size === 0) return snapshot;
  return {
    ...snapshot,
    products: snapshot.products.map((product) => {
      if (!product.trackInventory || !product.variants.some((variant) => soldQuantityByVariantId.has(variant.id))) return product;
      return {
        ...product,
        variants: product.variants.map((variant) => {
          const soldQuantity = soldQuantityByVariantId.get(variant.id);
          if (!soldQuantity) return variant;
          return { ...variant, stock: variant.stock.map((level) => (level.locationId === snapshot.locationId ? { ...level, onHand: Math.max(0, level.onHand - soldQuantity) } : level)) };
        }),
      };
    }),
  };
}
