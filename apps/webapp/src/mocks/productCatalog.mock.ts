import type { Product, ProductSummary, SponsoredPlacement } from "@/types";
import type { ProductCollection } from "@/types/commerce.type";

import { beautyHomeFoodAndKidsSeeds } from "./catalogBeautyHomeFoodKids.mock";
import { fashionShoesAndGadgetSeeds } from "./catalogFashionShoesGadgets.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { productImageUrlsForProduct, type CatalogProductKey } from "./mockImages.mock";
import { findDirectoryStoreById, summariseStore } from "./storeDirectory.mock";

export interface CatalogProductSeed {
  readonly key: CatalogProductKey;
  readonly storeId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly usdCents: number;
  readonly stock: number;
  readonly sizes: readonly string[];
  readonly colors: readonly string[];
  readonly rating: number;
  readonly reviewCount: number;
  readonly addedDaysAgo: number;
  readonly salePercent?: number;
}

export const catalogProductSeeds: readonly CatalogProductSeed[] = [...fashionShoesAndGadgetSeeds, ...beautyHomeFoodAndKidsSeeds];

const MART_SPONSORED_PRODUCT_KEYS: readonly CatalogProductKey[] = ["g1", "b3", "s2"];

export const productIdForKey = (key: CatalogProductKey) => `pr_${key}`;

const stockLevelsByProductId = new Map<string, number>(catalogProductSeeds.map((seed) => [productIdForKey(seed.key), seed.stock]));

export const findCatalogSeedByProductId = (productId: string): CatalogProductSeed | undefined =>
  catalogProductSeeds.find((seed) => productIdForKey(seed.key) === productId);

export const discountedUsdCents = (seed: CatalogProductSeed) => Math.round(seed.usdCents * (1 - (seed.salePercent ?? 0) / 100));

export const buildSponsoredPlacementForSeed = (seed: CatalogProductSeed): SponsoredPlacement => ({
  campaignId: `cmp_${seed.key}`,
  label: "Sponsored",
  advertiserName: findDirectoryStoreById(seed.storeId).name,
  ctaLabel: "Shop now",
});

export const isMartSponsoredSeed = (seed: CatalogProductSeed) => MART_SPONSORED_PRODUCT_KEYS.includes(seed.key);

export function buildCatalogProductSummary(seed: CatalogProductSeed, options: { sponsored?: boolean } = {}): ProductSummary {
  const productId = productIdForKey(seed.key);
  const store = findDirectoryStoreById(seed.storeId);
  return {
    id: productId,
    name: seed.name,
    storeName: store.name,
    storeVerified: store.verified,
    price: convertUsdCentsToViewerCurrency(discountedUsdCents(seed)),
    imageUrl: productImageUrlsForProduct(seed.key)[0] ?? null,
    liked: false,
    stock: stockLevelsByProductId.get(productId) ?? seed.stock,
    sponsored: options.sponsored ? buildSponsoredPlacementForSeed(seed) : null,
  };
}

export const listCatalogProductSummaries = (): ProductSummary[] => catalogProductSeeds.map((seed) => buildCatalogProductSummary(seed));

export const listMartProductSummaries = (categoryId: string | null): ProductSummary[] => {
  const seedsInCategory = catalogProductSeeds.filter((seed) => !categoryId || seed.categoryId === categoryId);
  const sponsoredFirst = [...seedsInCategory.filter(isMartSponsoredSeed), ...seedsInCategory.filter((seed) => !isMartSponsoredSeed(seed))];
  return sponsoredFirst.map((seed) => buildCatalogProductSummary(seed, { sponsored: isMartSponsoredSeed(seed) }));
};

export const productSummaryByKey = (key: CatalogProductKey): ProductSummary =>
  buildCatalogProductSummary(catalogProductSeeds.find((seed) => seed.key === key)!);

export const listProductSummariesInStore = (storeId: string): ProductSummary[] =>
  catalogProductSeeds.filter((seed) => seed.storeId === storeId).map((seed) => buildCatalogProductSummary(seed));

export const listProductsInCollection = (collection: ProductCollection): ProductSummary[] => {
  const organic = listOrganicProductsInCollection(collection);
  const sponsoredSeed = catalogProductSeeds.find((seed) => isMartSponsoredSeed(seed) && !organic.some((product) => product.id === productIdForKey(seed.key)));
  return sponsoredSeed ? [organic[0]!, buildCatalogProductSummary(sponsoredSeed, { sponsored: true }), ...organic.slice(1)].filter(Boolean) : organic;
};

const listOrganicProductsInCollection = (collection: ProductCollection): ProductSummary[] => {
  if (collection === "sales_of_the_day") return catalogProductSeeds.filter((seed) => seed.salePercent).map((seed) => buildCatalogProductSummary(seed));
  if (collection === "new_arrivals") {
    return [...catalogProductSeeds]
      .filter((seed) => seed.addedDaysAgo <= 7)
      .sort((a, b) => a.addedDaysAgo - b.addedDaysAgo)
      .map((seed) => buildCatalogProductSummary(seed));
  }
  return catalogProductSeeds
    .filter((seed) => findDirectoryStoreById(seed.storeId).verified && seed.rating >= 4.6)
    .map((seed) => buildCatalogProductSummary(seed));
};

const buildFeaturedWithProducts = (seed: CatalogProductSeed): ProductSummary[] => {
  const sameStore = catalogProductSeeds.filter((other) => other.storeId === seed.storeId && other.key !== seed.key);
  const sameCategoryElsewhere = catalogProductSeeds.filter((other) => other.categoryId === seed.categoryId && other.storeId !== seed.storeId);
  const organic = [...sameStore, ...sameCategoryElsewhere].slice(0, 5).map((other) => buildCatalogProductSummary(other));
  const sponsoredSeed =
    catalogProductSeeds.find((other) => isMartSponsoredSeed(other) && other.categoryId === seed.categoryId && other.key !== seed.key) ??
    catalogProductSeeds.find((other) => isMartSponsoredSeed(other) && other.key !== seed.key)!;
  return [buildCatalogProductSummary(sponsoredSeed, { sponsored: true }), ...organic.filter((product) => product.id !== productIdForKey(sponsoredSeed.key))];
};

const buildPromoLine = (seed: CatalogProductSeed) => {
  if (seed.salePercent) return `${seed.salePercent}% off today • Paid safely into escrow`;
  if (seed.addedDaysAgo <= 7) return "New arrival • Paid safely into escrow";
  return null;
};

export function buildCatalogProductDetail(productId: string): Product | undefined {
  const seed = findCatalogSeedByProductId(productId);
  if (!seed) return undefined;
  const store = findDirectoryStoreById(seed.storeId);
  return {
    ...buildCatalogProductSummary(seed, { sponsored: isMartSponsoredSeed(seed) }),
    images: productImageUrlsForProduct(seed.key),
    title: seed.title,
    rating: seed.rating,
    promo: buildPromoLine(seed),
    sizes: seed.sizes,
    colors: seed.colors,
    shippingInfo: store.shippingInfo,
    description: seed.description,
    store: summariseStore(store),
    related: buildFeaturedWithProducts(seed),
  };
}

export const reduceCatalogStock = (productId: string, quantity: number) => {
  const current = stockLevelsByProductId.get(productId);
  if (current !== undefined) stockLevelsByProductId.set(productId, Math.max(0, current - quantity));
};
