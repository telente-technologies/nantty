import type { MartHome } from "@/types/commerce.type";
import type { Page, Product, ProductSummary } from "@/types";

import { api } from "./apiClient.service";

export const productsService = {
  fetchMartHome: () => api.get<MartHome>("/api/v1/mart/home"),
  fetchProductsPage: (categoryId: string | null, cursor: string | null) =>
    api.get<Page<ProductSummary>>("/api/v1/products", { categoryId: categoryId ?? undefined, cursor: cursor ?? undefined }),
  fetchProductDetailById: (productId: string) => api.get<Product>(`/api/v1/products/${productId}`),
  fetchFeaturedProducts: () => api.get<ProductSummary[]>("/api/v1/products/featured"),
  likeProduct: (productId: string) => api.post<void>(`/api/v1/products/${productId}/like`),
  unlikeProduct: (productId: string) => api.delete<void>(`/api/v1/products/${productId}/like`),
  bookmarkProduct: (productId: string) => api.post<void>(`/api/v1/products/${productId}/bookmark`),
};
