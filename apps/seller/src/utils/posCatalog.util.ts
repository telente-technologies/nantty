import type { Product, ProductVariant } from "@/types/catalog.type";

export function readAvailableStockAtLocation(variant: ProductVariant, locationId: string | null): number {
  const stockLevel = variant.stock.find((level) => level.locationId === locationId);
  return stockLevel ? stockLevel.onHand - stockLevel.reserved : 0;
}

export function readTotalAvailableStockForProductAtLocation(product: Product, locationId: string | null): number {
  return product.variants.reduce((sum, variant) => sum + readAvailableStockAtLocation(variant, locationId), 0);
}

export function findVariantByScannedCode(products: readonly Product[], scannedCode: string): { product: Product; variant: ProductVariant } | null {
  const normalisedCode = scannedCode.trim().toUpperCase();
  if (!normalisedCode) return null;
  for (const product of products) {
    const variant = product.variants.find((candidate) => candidate.barcode === normalisedCode || candidate.sku.toUpperCase() === normalisedCode);
    if (variant) return { product, variant };
  }
  return null;
}

export function filterProductsForRegisterSearch(products: readonly Product[], searchText: string, categoryId: string | null): Product[] {
  const needle = searchText.trim().toLowerCase();
  return products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false;
    if (!needle) return true;
    return product.name.toLowerCase().includes(needle) || product.tags.some((tag) => tag.toLowerCase().includes(needle)) || product.variants.some((variant) => variant.sku.toLowerCase().includes(needle) || variant.barcode?.includes(needle));
  });
}

export function buildProductInitials(productName: string): string {
  return productName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
}
