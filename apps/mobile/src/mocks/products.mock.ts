import { ApiError } from "@/errors/api.error";
import type { Page, ProductSummary } from "@/types";
import type { MartHome, ProductCollection, StoreDetail } from "@/types/commerce.type";

import { BRAND_ID_BY_PRODUCT_KEY, brandTagForProductKey, findBrandRecord, isVerifiedOfficialStoreOfBrand, mockBrandRecords, presentBrandSummary } from "./brandDirectory.mock";
import { followedBrandIds } from "./brands.mock";
import { martImageUrl } from "./mockImages.mock";
import { isAuthorContentVisibleToSignedInViewer } from "./socialGraph.mock";
import { listPostsByAuthor, withCurrentProductPrices } from "./postCatalog.mock";
import {
  buildCatalogProductDetail,
  catalogProductSeeds,
  findCatalogSeedByProductId,
  listMartProductSummaries,
  listProductSummariesInStore,
  listProductsInCollection,
} from "./productCatalog.mock";
import { isSavedBySignedInViewer, saveTargetForSignedInViewer, unsaveTargetForSignedInViewer } from "./savedEntries.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildReviewSummaryForProduct } from "./reviewFixtures.mock";
import { directoryStores, productCategories, storeBannerUrl, summariseStore } from "./storeDirectory.mock";

const PAGE_SIZE = 12;
const likedProductIds = new Set<string>();
const followedStoreIds = new Set<string>(["s_ada", "s_glow"]);

const withLikeState = (product: ProductSummary): ProductSummary => ({ ...product, liked: likedProductIds.has(product.id) });

const pageOf = (products: readonly ProductSummary[], cursor: string | null): Page<ProductSummary> => {
  const start = Number(cursor ?? 0);
  return { data: products.slice(start, start + PAGE_SIZE).map(withLikeState), nextCursor: start + PAGE_SIZE < products.length ? String(start + PAGE_SIZE) : null };
};

const buildStoreDetail = (storeId: string): StoreDetail => {
  const store = directoryStores.find((candidate) => candidate.id === storeId);
  if (!store) throw new ApiError(404, "Store not found");
  return {
    ...summariseStore(store),
    ownerUserId: store.ownerUserKey,
    bannerUrl: storeBannerUrl(store),
    handle: store.handle,
    bio: store.bio,
    followers: store.followers + (followedStoreIds.has(store.id) ? 1 : 0),
    productsCount: catalogProductSeeds.filter((seed) => seed.storeId === store.id).length,
    isFollowing: followedStoreIds.has(store.id),
    verified: store.verified,
    joinedAt: store.joinedAt,
    posts: (isAuthorContentVisibleToSignedInViewer(store.ownerUserKey) ? listPostsByAuthor(store.ownerUserKey) : []).map(withCurrentProductPrices),
    officialBrand: (() => {
      const brand = mockBrandRecords.find((candidate) => isVerifiedOfficialStoreOfBrand(candidate, store.id));
      return brand ? presentBrandSummary(brand, followedBrandIds) : null;
    })(),
  };
};

export const productsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/mart/home", (): MartHome => ({
    banners: [
      { id: "b_1", imageUrl: martImageUrl("heroBanner", 1200) },
      { id: "b_2", imageUrl: martImageUrl("heroBannerAlt", 1200) },
    ],
    salesOfTheDayImageUrl: martImageUrl("salesOfTheDay"),
    featuredBrandsImageUrl: martImageUrl("featuredBrands"),
    newArrivalsImageUrl: martImageUrl("newArrivals"),
    categories: productCategories,
  })),
  createMockRoute("GET", "/api/v1/categories", () => productCategories),
  createMockRoute("GET", "/api/v1/products", ({ query }) => {
    const collection = query.get("collection") as ProductCollection | null;
    const products = collection ? listProductsInCollection(collection) : listMartProductSummaries(query.get("categoryId"));
    return pageOf(products, query.get("cursor"));
  }),
  createMockRoute("GET", "/api/v1/products/featured", () => listProductsInCollection("featured_brands").slice(0, 8).map(withLikeState)),
  createMockRoute("GET", "/api/v1/products/:productId", ({ params }) => {
    const detail = buildCatalogProductDetail(params.productId!);
    const seed = findCatalogSeedByProductId(params.productId!);
    if (!detail || !seed) throw new ApiError(404, "This product is no longer available");
    const brand = findBrandRecord(BRAND_ID_BY_PRODUCT_KEY[seed.key] ?? "");
    return {
      ...detail,
      liked: likedProductIds.has(detail.id),
      savedByViewer: isSavedBySignedInViewer("product", detail.id),
      saveCount: 120 + (detail.id.length * 37) % 900,
      related: detail.related.map(withLikeState),
      brand: brandTagForProductKey(seed.key),
      isOfficialStore: !!brand && isVerifiedOfficialStoreOfBrand(brand, seed.storeId),
    };
  }),
  createMockRoute("POST", "/api/v1/products/:productId/like", ({ params }) => void likedProductIds.add(params.productId!)),
  createMockRoute("DELETE", "/api/v1/products/:productId/like", ({ params }) => void likedProductIds.delete(params.productId!)),
  createMockRoute("POST", "/api/v1/products/:productId/bookmark", ({ params }) => saveTargetForSignedInViewer("product", params.productId!)),
  createMockRoute("DELETE", "/api/v1/products/:productId/bookmark", ({ params }) => unsaveTargetForSignedInViewer("product", params.productId!)),
  createMockRoute("GET", "/api/v1/products/:productId/reviews", ({ params }) => buildReviewSummaryForProduct(params.productId!)),
  createMockRoute("POST", "/api/v1/products/:productId/reviews", () => undefined),
  createMockRoute("GET", "/api/v1/stores/:storeId", ({ params }) => buildStoreDetail(params.storeId!)),
  createMockRoute("GET", "/api/v1/stores/:storeId/products", ({ params }) => listProductSummariesInStore(params.storeId!).map(withLikeState)),
  createMockRoute("POST", "/api/v1/stores/:storeId/follow", ({ params }) => void followedStoreIds.add(params.storeId!)),
  createMockRoute("DELETE", "/api/v1/stores/:storeId/follow", ({ params }) => void followedStoreIds.delete(params.storeId!)),
];
