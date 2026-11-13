import type { BrandedProduct } from "@/types/brand.type";
import type { MartHome, ProductCollection } from "@/types/commerce.type";
import type { MartHighlight } from "@/types/martHighlight.type";
import type { Page, ProductSummary } from "@/types";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const productsService = {
  fetchMartHome: () => sendRequestToWebappServer<MartHome>("/api/v1/mart/home"),
  fetchProductsYouMightLike: (surface: "for_you" | "mart_home" | "clips" = "for_you") =>
    sendRequestToWebappServer<{ readonly products: readonly ProductSummary[]; readonly source: "personalized" | "popular" }>("/api/v1/mart/recommendations/for-you", { query: { surface } }),
  fetchMartHighlights: (limit = 6) => sendRequestToWebappServer<Page<MartHighlight>>("/api/v1/mart/highlights", { query: { limit } }),
  fetchProductsPage: (categoryId: string | null, cursor: string | null) =>
    sendRequestToWebappServer<Page<ProductSummary>>("/api/v1/products", { query: { categoryId: categoryId ?? undefined, cursor: cursor ?? undefined } }),
  fetchProductCollectionPage: (collection: ProductCollection, cursor: string | null) =>
    sendRequestToWebappServer<Page<ProductSummary>>("/api/v1/products", { query: { collection, cursor: cursor ?? undefined } }),
  fetchProductDetailById: (productId: string) => sendRequestToWebappServer<BrandedProduct>(`/api/v1/products/${productId}`),
  fetchFeaturedProducts: () => sendListRequestToWebappServer<ProductSummary>("/api/v1/products/featured"),
  likeProduct: (productId: string) => sendRequestToWebappServer<void>(`/api/v1/products/${productId}/like`, { method: "POST" }),
  unlikeProduct: (productId: string) => sendRequestToWebappServer<void>(`/api/v1/products/${productId}/like`, { method: "DELETE" }),
  bookmarkProduct: (productId: string) => sendRequestToWebappServer<void>(`/api/v1/products/${productId}/bookmark`, { method: "POST" }),
};
