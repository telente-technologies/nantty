import { randomUUID } from "node:crypto";

import type { DiscoveryServices, SponsoredSurface } from "../../../interfaces/discovery.interface.js";
import { insertSponsoredItems } from "../../../utils/sponsoredInsertion.util.js";
import type { ProductCandidate, ProductRecommendationSurface, ViewerContext } from "../../intelligence/models/intelligenceRanking.model.js";
import type { SponsorableProduct } from "../dtos/products.dto.js";
import type { ProductRecord } from "../models/products.model.js";
import type { ProductsRepository } from "../repositories/products.repository.js";

const ANONYMOUS_VIEWER_ID = "anonymous";

export interface ProductDiscoveryViewer {
  readonly viewerId: string | undefined;
  readonly country: string | null;
}

export function convertProductToCandidate(product: ProductRecord): ProductCandidate {
  return {
    productId: product.id,
    storeId: product.storeId,
    categoryId: product.categoryId,
    price: { amountMinor: product.price, currency: product.currency },
    rating: product.ratingCount > 0 ? Math.min(5, Math.max(0, product.ratingAverage)) : null,
    salesCount: product.salesCount,
    viewCount: 0,
    inStock: true,
  };
}

function buildViewer(discovery: DiscoveryServices, viewer: ProductDiscoveryViewer): ViewerContext {
  return {
    userId: discovery.hasher.hashUserId(viewer.viewerId ?? ANONYMOUS_VIEWER_ID),
    country: viewer.country !== null && /^[A-Z]{2}$/.test(viewer.country) ? viewer.country : null,
  };
}

export function reorderByIds<T extends { readonly id: string }>(items: readonly T[], orderedIds: readonly string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
  const placed = new Set(orderedIds);
  return [...ordered, ...items.filter((item) => !placed.has(item.id))];
}

export async function rankProductsForViewer(
  discovery: DiscoveryServices | undefined,
  products: readonly ProductRecord[],
  surface: ProductRecommendationSurface,
  viewer: ProductDiscoveryViewer,
  now: Date,
  anchor?: ProductRecord,
): Promise<ProductRecord[]> {
  if (discovery === undefined || products.length < 2) return [...products];
  const outcome = await discovery.ranking.recommendProducts({
    requestId: `products_${randomUUID()}`,
    surface,
    viewer: buildViewer(discovery, viewer),
    ...(anchor === undefined ? {} : { anchorProduct: convertProductToCandidate(anchor) }),
    candidates: products.map(convertProductToCandidate),
    limit: Math.min(100, products.length),
    now: now.toISOString(),
  });
  if (outcome.source === "fallback" && anchor === undefined) return [...products];
  return reorderByIds(products, outcome.response.items.map((item) => item.itemId));
}

export async function rerankSearchResults(
  discovery: DiscoveryServices | undefined,
  products: readonly ProductRecord[],
  viewer: ProductDiscoveryViewer,
  now: Date,
): Promise<ProductRecord[]> {
  if (discovery === undefined || products.length < 2) return [...products];
  const outcome = await discovery.ranking.rerankSearch({
    requestId: `search_${randomUUID()}`,
    viewer: buildViewer(discovery, viewer),
    candidates: products.map((product, index) => ({
      itemId: product.id,
      itemType: "product" as const,
      textRelevanceScore: products.length - index,
      authorId: product.storeId,
      popularityCount: product.salesCount,
      createdAt: product.createdAt.toISOString(),
    })),
    limit: Math.min(200, products.length),
    now: now.toISOString(),
  });
  return reorderByIds(products, outcome.response.items.map((item) => item.itemId));
}

export async function attachSponsoredProducts(
  discovery: DiscoveryServices | undefined,
  products: ProductsRepository,
  organic: readonly ProductRecord[],
  surface: Extract<SponsoredSurface, "mart" | "search">,
  viewer: ProductDiscoveryViewer,
  hiddenStoreIds: readonly string[],
): Promise<SponsorableProduct[]> {
  if (discovery === undefined || viewer.viewerId === undefined || organic.length === 0) return [...organic];
  const insertions = await discovery.sponsoredContent.selectSponsoredItems({
    viewerId: viewer.viewerId,
    surface,
    organicItems: organic.map((product) => ({ itemId: product.id })),
    country: viewer.country,
  });
  const productInsertions = insertions.filter((insertion) => insertion.itemKind === "product");
  if (productInsertions.length === 0) return [...organic];
  const organicIds = new Set(organic.map((product) => product.id));
  const hidden = new Set(hiddenStoreIds);
  const sponsoredProducts = new Map(
    (await products.findManyByIds(productInsertions.map((insertion) => insertion.itemId)))
      .filter((product) => product.status === "published" && !hidden.has(product.storeId) && !organicIds.has(product.id))
      .map((product) => [product.id, product]),
  );
  const items = productInsertions.flatMap((insertion) => {
    const product = sponsoredProducts.get(insertion.itemId);
    return product === undefined ? [] : [{ position: insertion.position, item: { ...product, sponsored: insertion.sponsored } as SponsorableProduct }];
  });
  return insertSponsoredItems<SponsorableProduct>(organic, items);
}
