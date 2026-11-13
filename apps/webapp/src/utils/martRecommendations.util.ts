import type { ProductSummary } from "@/types";

/** Put server-ranked recommendations first, then fill from the catalog without duplicates. */
export function prioritizeMartRecommendations(
  catalog: readonly ProductSummary[],
  recommendations: readonly ProductSummary[],
): ProductSummary[] {
  const seen = new Set<string>();
  const ordered: ProductSummary[] = [];

  for (const product of [...recommendations, ...catalog]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    ordered.push(product);
  }

  return ordered;
}
