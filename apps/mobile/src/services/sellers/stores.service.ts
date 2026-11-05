import type { MyStoreSummary, StoreDetail } from "@/types/commerce.type";
import type { ProductSummary } from "@/types";
import { parseStoreFollowState } from "@nantty/contracts";

import { api } from "../core/apiClient.service";

export const storesService = {
  fetchStoreById: (storeId: string) => api.get<StoreDetail>(`/api/v1/stores/${encodeURIComponent(storeId)}`),
  fetchStoreProducts: (storeId: string) => api.getList<ProductSummary>(`/api/v1/stores/${encodeURIComponent(storeId)}/products`),
  followStore: async (storeId: string) => parseStoreFollowState(
    await api.post<unknown>(`/api/v1/stores/${encodeURIComponent(storeId)}/follow`), storeId,
  ),
  unfollowStore: async (storeId: string) => parseStoreFollowState(
    await api.delete<unknown>(`/api/v1/stores/${encodeURIComponent(storeId)}/follow`), storeId,
  ),
  fetchMyStores: () => api.getList<MyStoreSummary>("/api/v1/seller/stores/mine"),
};
