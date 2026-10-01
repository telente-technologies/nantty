import type { BrandedProduct } from "@/types/brand.type";
import type { MartHome, ProductCollection } from "@/types/commerce.type";
import type { Page, ProductSummary } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const productsService = {
  fetchMartHome: () => sendRequestToWebappServer<MartHome>("/api/v1/mart/home"),
  fetchProductsPage: (categoryId: string | null, cursor: string | null) =>
    sendRequestToWebappServer<Page<ProductSummary>>("/api/v1/products", { query: { categoryId: categoryId ?? undefined, cursor: cursor ?? undefined } }),
  fetchProductCollectionPage: (collection: ProductCollection, cursor: string | null) =>
    sendRequestToWebappServer<Page<ProductSummary>>("/api/v1/products", { query: { collection, cursor: cursor ?? undefined } }),
  fetchProductDetailById: (productId: string) => sendRequestToWebappServer<BrandedProduct>(`/api/v1/products/${productId}`),
  fetchFeaturedProducts: () => sendRequestToWebappServer<ProductSummary[]>("/api/v1/products/featured"),
  likeProduct: (productId: string) => sendRequestToWebappServer<void>(`/api/v1/products/${productId}/like`, { method: "POST" }),
  unlikeProduct: (productId: string) => sendRequestToWebappServer<void>(`/api/v1/products/${productId}/like`, { method: "DELETE" }),
  bookmarkProduct: (productId: string) => sendRequestToWebappServer<void>(`/api/v1/products/${productId}/bookmark`, { method: "POST" }),
};
