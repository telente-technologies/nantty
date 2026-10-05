import type { CatalogProductSummary, ProductCatalog } from "../interfaces/productCatalog.interface.js";

interface ProductSearchSource {
  readonly productId: string;
  readonly storeId: string;
  readonly name: string;
  readonly priceAmountMinor: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly stock: number;
  readonly status: string;
  readonly visibility: string;
  readonly storeActive: boolean;
}

const taggableVisibilities = new Set(["public", "link_only"]);
const cacheLifetimeMs = 60_000;
const maximumCacheEntries = 5_000;

export function toCatalogProductSummary(source: ProductSearchSource): CatalogProductSummary {
  return {
    id: source.productId, name: source.name, price: { amountMinor: source.priceAmountMinor, currency: source.currency }, imageUrl: source.imageUrl ?? null,
    stock: source.stock, storeId: source.storeId, taggable: source.status === "active" && source.storeActive && taggableVisibilities.has(source.visibility),
  };
}

export function createHttpProductCatalog(source: { readonly baseUrl: string; readonly internalToken: string }, timeoutMs = 1500, now: () => number = Date.now): ProductCatalog {
  const cache = new Map<string, { readonly value: CatalogProductSummary | null; readonly expiresAt: number }>();
  async function fetchProduct(productId: string): Promise<CatalogProductSummary | null> {
    const cached = cache.get(productId);
    if (cached !== undefined && cached.expiresAt > now()) return cached.value;
    const response = await fetch(new URL(`/api/v1/internal/search-sources/products/${encodeURIComponent(productId)}`, source.baseUrl), { headers: { "x-internal-token": source.internalToken }, signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
    if (response === null || (!response.ok && response.status !== 404)) return cached?.value ?? null;
    const value = response.status === 404 ? null : toCatalogProductSummary((await response.json()) as ProductSearchSource);
    if (cache.size >= maximumCacheEntries) cache.delete(cache.keys().next().value as string);
    cache.set(productId, { value, expiresAt: now() + cacheLifetimeMs });
    return value;
  }
  return {
    async findProducts(productIds) {
      const found = await Promise.all([...new Set(productIds)].map(async (productId) => [productId, await fetchProduct(productId)] as const));
      return new Map(found.flatMap(([productId, product]) => (product === null ? [] : [[productId, product] as const])));
    },
  };
}
