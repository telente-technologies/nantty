import { ApiError } from "@/errors/api.error";
import type { Page, ProductSummary } from "@/types";
import type { MartHome, ProductCollection, SearchResults, StoreDetail } from "@/types/commerce.type";

import { BRAND_ID_BY_PRODUCT_KEY, brandTagForProductKey, findBrandRecord, isVerifiedOfficialStoreOfBrand, mockBrandRecords, presentBrandSummary } from "./brandDirectory.mock";
import { followedBrandIds } from "./brands.mock";
import { martImageUrl } from "./mockImages.mock";
import { isAuthorContentVisibleToSignedInViewer } from "./socialGraph.mock";
import { listPostsByAuthor, withCurrentProductPrices } from "./postCatalog.mock";
import {
  buildCatalogProductDetail,
  buildCatalogProductSummary,
  catalogProductSeeds,
  findCatalogSeedByProductId,
  isMartSponsoredSeed,
  listMartProductSummaries,
  listProductSummariesInStore,
  listProductsInCollection,
} from "./productCatalog.mock";
import { isSavedBySignedInViewer, saveTargetForSignedInViewer, unsaveTargetForSignedInViewer } from "./savedEntries.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildReviewSummaryForProduct } from "./reviewFixtures.mock";
import { directoryStores, findDirectoryStoreById, productCategories, storeBannerUrl, summariseStore } from "./storeDirectory.mock";
import { directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

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

const matchesSearch = (text: string, term: string) => text.toLowerCase().includes(term);

function searchCatalog(term: string): SearchResults {
  const matchingSeeds = catalogProductSeeds.filter(
    (seed) => matchesSearch(seed.name, term) || matchesSearch(seed.title, term) || matchesSearch(findDirectoryStoreById(seed.storeId).name, term),
  );
  const sponsoredSeed =
    catalogProductSeeds.find((seed) => isMartSponsoredSeed(seed) && seed.categoryId === matchingSeeds[0]?.categoryId) ??
    (matchingSeeds.length > 0 ? catalogProductSeeds.find(isMartSponsoredSeed) : undefined);
  const organic = matchingSeeds.filter((seed) => seed !== sponsoredSeed).map((seed) => buildCatalogProductSummary(seed));
  const sponsored = sponsoredSeed ? [buildCatalogProductSummary(sponsoredSeed, { sponsored: true })] : [];
  return {
    products: [...sponsored, ...organic].slice(0, 16).map(withLikeState),
    stores: directoryStores.filter((store) => matchesSearch(store.name, term) || matchesSearch(store.bio, term)).map(summariseStore),
    brands: mockBrandRecords
      .filter((brand) => matchesSearch(brand.name, term) || matchesSearch(brand.handle, term) || matchesSearch(brand.description, term))
      .map((brand) => presentBrandSummary(brand, followedBrandIds)),
    people: directoryUsersExcludingAccounts
      .filter((user) => matchesSearch(user.name, term) || matchesSearch(user.username, term))
      .slice(0, 8)
      .map(summariseUser),
  };
}

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
  createMockRoute("GET", "/api/v1/search", ({ query }) => searchCatalog((query.get("q") ?? "").trim().toLowerCase())),
];
