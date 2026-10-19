import type {
  AdBalance, AdBalanceTopUpCheckout, AdBalanceWithdrawal, AdBalanceWithdrawalQuote, AdBalanceTransactionPage, AdLocationTarget, BoostBudgetChangePaymentMethod, BoostBudgetChangeRequest, BoostBudgetChangeResult, BoostBudgetQuote, BoostListPage, BoostReport,
} from "@/types/adsHub.type";
import type { Boost, CreateBoostRequest, CreatedBoost } from "@/types/boost.type";
import type { Money } from "@/types/money.type";

import { sendRequestToWebappServer } from "./clientApi.service";

const boostPath = (boostId: string, suffix = "") => `/api/v1/ads/boosts/${encodeURIComponent(boostId)}${suffix}`;

export const adsHubService = {
  createBoost: (request: CreateBoostRequest, idempotencyKey: string, stepUpToken?: string) =>
    sendRequestToWebappServer<CreatedBoost>("/api/v1/ads/boosts", { method: "POST", body: request, idempotencyKey, ...(stepUpToken ? { stepUpToken } : {}) }),
  listMyBoosts: (statuses: readonly string[], cursor?: string | null) =>
    sendRequestToWebappServer<BoostListPage>("/api/v1/ads/boosts", { query: { status: statuses.length > 0 ? statuses.join(",") : undefined, cursor: cursor ?? undefined, limit: 20 } }),
  pauseBoost: (boostId: string, idempotencyKey: string) => sendRequestToWebappServer<Boost>(boostPath(boostId, "/pause"), { method: "POST", body: {}, idempotencyKey }),
  resumeBoost: (boostId: string, idempotencyKey: string) => sendRequestToWebappServer<Boost>(boostPath(boostId, "/resume"), { method: "POST", body: {}, idempotencyKey }),
  stopBoost: (boostId: string, idempotencyKey: string) => sendRequestToWebappServer<Boost>(boostPath(boostId, "/cancel"), { method: "POST", body: {}, idempotencyKey }),
  quoteBudgetChange: (boostId: string, request: BoostBudgetChangeRequest) => sendRequestToWebappServer<BoostBudgetQuote>(boostPath(boostId, "/budget/quote"), { method: "POST", body: request }),
  changeBudget: (boostId: string, request: BoostBudgetChangeRequest & { readonly paymentMethod: BoostBudgetChangePaymentMethod }, idempotencyKey: string) =>
    sendRequestToWebappServer<BoostBudgetChangeResult>(boostPath(boostId, "/budget"), { method: "POST", body: request, idempotencyKey }),
  fetchBoostReport: (boostId: string) => sendRequestToWebappServer<BoostReport>(boostPath(boostId, "/report")),
  fetchAdBalance: () => sendRequestToWebappServer<AdBalance>("/api/v1/ads/boosts/balance"),
  listAdBalanceTransactions: (cursor?: string | null) => sendRequestToWebappServer<AdBalanceTransactionPage>("/api/v1/ads/boosts/balance/transactions", { query: { cursor: cursor ?? undefined } }),
  startAdBalanceTopUp: (amount: Money, idempotencyKey: string) =>
    sendRequestToWebappServer<AdBalanceTopUpCheckout>("/api/v1/ads/boosts/balance/top-ups", { method: "POST", body: { amount }, idempotencyKey }),
  quoteAdBalanceWithdrawal: (amount: Money) => sendRequestToWebappServer<AdBalanceWithdrawalQuote>("/api/v1/ads/boosts/balance/withdrawals/quote", { method: "POST", body: { amount } }),
  withdrawAdBalance: (amount: Money, idempotencyKey: string, stepUpToken?: string) =>
    sendRequestToWebappServer<AdBalanceWithdrawal>("/api/v1/ads/boosts/balance/withdrawals", { method: "POST", body: { amount }, idempotencyKey, ...(stepUpToken ? { stepUpToken } : {}) }),
  searchAdLocations: (search: string, countryCode: string) =>
    sendRequestToWebappServer<{ readonly data: readonly AdLocationTarget[] }>("/api/v1/ads/locations", { query: { search, countryCode } }),
};
