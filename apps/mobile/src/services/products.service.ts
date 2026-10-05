import type { MartHome, ProductCollection } from "@/types/commerce.type";
import type { BrandedProduct } from "@/types/brand.type";
import type { MartHighlight } from "@/types/martHighlight.type";
import type { Page, ProductSummary } from "@/types";

import { api } from "./apiClient.service";

export const productsService = {
  fetchMartHome: () => api.get<MartHome>("/api/v1/mart/home"),
  fetchMartHighlights: (cursor: string | null, limit = 6) =>
    api.getPage<MartHighlight>("/api/v1/mart/highlights", { cursor: cursor ?? undefined, limit }),
  fetchProductsPage: (categoryId: string | null, cursor: string | null) =>
    api.get<Page<ProductSummary>>("/api/v1/products", { categoryId: categoryId ?? undefined, cursor: cursor ?? undefined }),
  fetchProductCollectionPage: (collection: ProductCollection, cursor: string | null) =>
    api.get<Page<ProductSummary>>("/api/v1/products", { collection, cursor: cursor ?? undefined }),
  fetchProductDetailById: (productId: string) => api.get<BrandedProduct>(`/api/v1/products/${productId}`),
  fetchFeaturedProducts: () => api.get<ProductSummary[]>("/api/v1/products/featured"),
  likeProduct: (productId: string) => api.post<void>(`/api/v1/products/${productId}/like`),
  unlikeProduct: (productId: string) => api.delete<void>(`/api/v1/products/${productId}/like`),
};
