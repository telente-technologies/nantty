import type { MyStoreSummary, StoreDetail } from "@/types/commerce.type";
import type { ProductSummary } from "@/types";

import { api } from "../core/apiClient.service";

export const storesService = {
  fetchStoreById: (storeId: string) => api.get<StoreDetail>(`/api/v1/stores/${storeId}`),
  fetchStoreProducts: (storeId: string) => api.getList<ProductSummary>(`/api/v1/stores/${storeId}/products`),
  followStore: (storeId: string) => api.post<void>(`/api/v1/stores/${storeId}/follow`),
  unfollowStore: (storeId: string) => api.delete<void>(`/api/v1/stores/${storeId}/follow`),
  fetchMyStores: () => api.getList<MyStoreSummary>("/api/v1/seller/stores/mine"),
};
