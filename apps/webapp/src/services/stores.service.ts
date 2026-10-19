import type { MyStoreSummary, StoreDetail } from "@/types/commerce.type";
import type { ProductSummary } from "@/types";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const storesService = {
  fetchStoreById: (storeId: string) => sendRequestToWebappServer<StoreDetail>(`/api/v1/stores/${storeId}`),
  fetchStoreProducts: (storeId: string) => sendListRequestToWebappServer<ProductSummary>(`/api/v1/stores/${storeId}/products`),
  followStore: (storeId: string) => sendRequestToWebappServer<void>(`/api/v1/stores/${storeId}/follow`, { method: "POST" }),
  unfollowStore: (storeId: string) => sendRequestToWebappServer<void>(`/api/v1/stores/${storeId}/follow`, { method: "DELETE" }),
  fetchMyStores: () => sendListRequestToWebappServer<MyStoreSummary>("/api/v1/seller/stores/mine"),
};
