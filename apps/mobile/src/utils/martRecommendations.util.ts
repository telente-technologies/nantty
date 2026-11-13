import type { ProductSummary } from "@/types";

/** Keep the server-ranked products first, then fill the Mart grid with unique catalog results. */
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
