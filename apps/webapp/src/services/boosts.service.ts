import type { Boost, BoostEstimate, BoostEstimateRequest, BoostOptions, CreateBoostRequest, CreatedBoost } from "@/types/boost.type";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

export const boostsService = {
  fetchBoostOptions: () => sendRequestToWebappServer<BoostOptions>("/api/v1/ads/boosts/options"),
  estimateBoostReach: (request: BoostEstimateRequest) =>
    sendRequestToWebappServer<BoostEstimate>("/api/v1/ads/boosts/estimate", { method: "POST", body: request }),
  createBoost: (request: CreateBoostRequest, stepUpToken?: string) =>
    sendRequestToWebappServer<CreatedBoost>("/api/v1/ads/boosts", { method: "POST", body: request, idempotencyKey: createIdempotencyKey("boost"), ...(stepUpToken ? { stepUpToken } : {}) }),
  fetchBoostById: (boostId: string) => sendRequestToWebappServer<Boost>(`/api/v1/ads/boosts/${encodeURIComponent(boostId)}`),
};
