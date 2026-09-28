import type { Category, Page, ProductSummary } from "@/types";
import type { ProductReviewSummary, StoreDetail } from "@/types/commerce.type";

import { buildMockProductDetail, mockProductCatalogue, mockStore } from "./commerceFixtures.mock";
import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";
import { buildMockFeedPost } from "./posts.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const categories: Category[] = ["All", "Fashion", "Kids", "Beauty & Personal Care", "Appliances", "Phones", "Computing"].map((name, i) => ({
  id: `c_${i}`,
  name,
}));

const likedProductIds = new Set<string>();
const withLikeState = (product: ProductSummary): ProductSummary => ({ ...product, liked: likedProductIds.has(product.id) });

const pageOfProducts = (cursor: string | null): Page<ProductSummary> => {
  const start = Number(cursor ?? 0);
  const data = mockProductCatalogue.slice(start, start + 12).map(withLikeState);
  return { data, nextCursor: start + 12 < mockProductCatalogue.length ? String(start + 12) : null };
};

const reviews: ProductReviewSummary = {
  average: 2.4,
  count: 103,
  reviews: Array.from({ length: 6 }, (_, i) => ({
    id: `r_${i}`,
    author: buildMockUserSummary(i + 10, i % 2 ? "Freda Dickinson" : "Carlos Trantow"),
    rating: (i % 5) + 1,
    text: "Figma ipsum component variant main layer. Group export vector mask community object arrow ellipse.",
    createdAt: isoDateHoursAgo(i * 20 + 3),
  })),
};

const store: StoreDetail = {
  ...mockStore,
  bannerUrl: null,
  handle: "usershop",
  bio: "Bio about the store in this space",
  followers: 300,
  productsCount: 40,
  isFollowing: false,
  verified: true,
  joinedAt: "2025-10-01T00:00:00.000Z",
  posts: [buildMockFeedPost(90), buildMockFeedPost(91)],
};

export const productsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/mart/home", () => ({
    banners: [{ id: "b_1", imageUrl: null }],
    salesOfTheDayImageUrl: null,
    featuredBrandsImageUrl: null,
    newArrivalsImageUrl: null,
    categories,
  })),
  createMockRoute("GET", "/api/v1/categories", () => categories),
  createMockRoute("GET", "/api/v1/products", ({ query }) => pageOfProducts(query.get("cursor"))),
  createMockRoute("GET", "/api/v1/products/featured", () => mockProductCatalogue.slice(0, 8).map(withLikeState)),
  createMockRoute("GET", "/api/v1/products/:productId", ({ params }) => {
    const detail = buildMockProductDetail(params.productId!);
    return { ...detail, liked: likedProductIds.has(detail.id), related: detail.related.map(withLikeState) };
  }),
  createMockRoute("POST", "/api/v1/products/:productId/like", ({ params }) => void likedProductIds.add(params.productId!)),
  createMockRoute("DELETE", "/api/v1/products/:productId/like", ({ params }) => void likedProductIds.delete(params.productId!)),
  createMockRoute("POST", "/api/v1/products/:productId/bookmark", () => undefined),
  createMockRoute("GET", "/api/v1/products/:productId/reviews", () => reviews),
  createMockRoute("POST", "/api/v1/products/:productId/reviews", () => undefined),
  createMockRoute("GET", "/api/v1/stores/:storeId", () => store),
  createMockRoute("GET", "/api/v1/stores/:storeId/products", () => mockProductCatalogue.slice(0, 12).map(withLikeState)),
  createMockRoute("POST", "/api/v1/stores/:storeId/follow", () => void Object.assign(store, { isFollowing: true })),
  createMockRoute("DELETE", "/api/v1/stores/:storeId/follow", () => void Object.assign(store, { isFollowing: false })),
  createMockRoute("GET", "/api/v1/search", ({ query }) => {
    const text = (query.get("q") ?? "").toLowerCase();
    return {
      products: mockProductCatalogue.filter((p) => p.name.toLowerCase().includes(text)).slice(0, 8),
      stores: [mockStore],
      people: [buildMockUserSummary(3, "Freda Dickinson"), buildMockUserSummary(4, "Carlos Trantow")],
    };
  }),
];
