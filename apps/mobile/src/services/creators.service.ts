import type { CreatorStatus, ProductSummary } from "@/types";

import { api } from "./apiClient.service";

export const creatorsService = {
  fetchMyCreatorStatus: () => api.get<CreatorStatus>("/api/v1/creators/me"),
  fetchMyAffiliatedProducts: () => api.getList<ProductSummary>("/api/v1/creators/me/affiliated-products"),
  pinProductToLive: (liveId: string, productId: string) => api.post<void>(`/api/v1/lives/${liveId}/pins`, { productId }),
};
