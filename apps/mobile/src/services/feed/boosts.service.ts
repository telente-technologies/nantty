import type { Boost, BoostEstimate, BoostEstimateRequest, BoostOptions, CreateBoostRequest, CreatedBoost } from "@/types/boost.type";

import { api } from "../core/apiClient.service";

export const boostsService = {
  fetchBoostOptions: () => api.get<BoostOptions>("/api/v1/ads/boosts/options"),
  estimateBoostReach: (request: BoostEstimateRequest) => api.post<BoostEstimate>("/api/v1/ads/boosts/estimate", request),
  createBoost: (request: CreateBoostRequest, idempotencyKey: string) => api.post<CreatedBoost>("/api/v1/ads/boosts", request, { idempotencyKey }),
  fetchBoostById: (boostId: string) => api.get<Boost>(`/api/v1/ads/boosts/${encodeURIComponent(boostId)}`),
};
