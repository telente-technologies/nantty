import type {
  AdBalance, AdBalanceTopUpCheckout, AdBalanceTransaction, AdBalanceWithdrawal, AdBalanceWithdrawalQuote, AdTargetingLocation, Boost, BoostBudgetChangeInput, BoostBudgetChangeRequest,
  BoostBudgetChangeResult, BoostBudgetQuote, BoostReport, BoostStatus,
} from "@/types/boost.type";
import type { Money, Topic } from "@/types";

import { api } from "../core/apiClient.service";

const boostPath = (boostId: string, suffix = "") => `/api/v1/ads/boosts/${encodeURIComponent(boostId)}${suffix}`;

export const adsHubService = {
  listMyBoosts: (statuses: readonly BoostStatus[], cursor?: string) =>
    api.getPage<Boost>("/api/v1/ads/boosts", { status: statuses.length > 0 ? statuses.join(",") : undefined, cursor, limit: 20 }),
  pauseBoost: (boostId: string, idempotencyKey: string) => api.post<Boost>(boostPath(boostId, "/pause"), {}, { idempotencyKey }),
  resumeBoost: (boostId: string, idempotencyKey: string) => api.post<Boost>(boostPath(boostId, "/resume"), {}, { idempotencyKey }),
  stopBoost: (boostId: string, idempotencyKey: string) => api.post<Boost>(boostPath(boostId, "/cancel"), {}, { idempotencyKey }),
  quoteBoostBudgetChange: (boostId: string, input: BoostBudgetChangeInput) => api.post<BoostBudgetQuote>(boostPath(boostId, "/budget/quote"), input),
  applyBoostBudgetChange: (boostId: string, request: BoostBudgetChangeRequest, idempotencyKey: string) =>
    api.post<BoostBudgetChangeResult>(boostPath(boostId, "/budget"), request, { idempotencyKey }),
  fetchBoostReport: (boostId: string) => api.get<BoostReport>(boostPath(boostId, "/report")),
  fetchAdBalance: () => api.get<AdBalance>("/api/v1/ads/boosts/balance"),
  listAdBalanceTransactions: (cursor?: string) => api.getPage<AdBalanceTransaction>("/api/v1/ads/boosts/balance/transactions", { cursor }),
  startAdBalanceTopUp: (amount: Money, idempotencyKey: string) => api.post<AdBalanceTopUpCheckout>("/api/v1/ads/boosts/balance/top-ups", { amount }, { idempotencyKey }),
  quoteAdBalanceWithdrawal: (amount: Money) => api.post<AdBalanceWithdrawalQuote>("/api/v1/ads/boosts/balance/withdrawals/quote", { amount }),
  withdrawAdBalance: (amount: Money, idempotencyKey: string, stepUpToken: string) =>
    api.post<AdBalanceWithdrawal>("/api/v1/ads/boosts/balance/withdrawals", { amount }, { idempotencyKey, headers: { "X-Step-Up-Token": stepUpToken } }),
  searchAdTargetingLocations: (search: string, countryCode: string) => api.getList<AdTargetingLocation>("/api/v1/ads/locations", { search: search || undefined, countryCode: countryCode || undefined }),
  listAdTargetingTopics: () => api.getList<Topic>("/api/v1/topics"),
};
