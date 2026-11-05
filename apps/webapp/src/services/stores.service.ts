import type { MyStoreSummary, StoreDetail } from "@/types/commerce.type";
import type { ProductSummary } from "@/types";
import { parseStoreFollowState } from "@nantty/contracts";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const storesService = {
  fetchStoreById: (storeId: string) => sendRequestToWebappServer<StoreDetail>(`/api/v1/stores/${encodeURIComponent(storeId)}`),
  fetchStoreProducts: (storeId: string) => sendListRequestToWebappServer<ProductSummary>(`/api/v1/stores/${encodeURIComponent(storeId)}/products`),
  followStore: async (storeId: string) => parseStoreFollowState(
    await sendRequestToWebappServer<unknown>(`/api/v1/stores/${encodeURIComponent(storeId)}/follow`, { method: "POST" }), storeId,
  ),
  unfollowStore: async (storeId: string) => parseStoreFollowState(
    await sendRequestToWebappServer<unknown>(`/api/v1/stores/${encodeURIComponent(storeId)}/follow`, { method: "DELETE" }), storeId,
  ),
  fetchMyStores: () => sendListRequestToWebappServer<MyStoreSummary>("/api/v1/seller/stores/mine"),
};
