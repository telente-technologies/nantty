import type { Page } from "@/types";
import type { BrandDeal, BrandDealInput, CreatorApplication, CreatorDashboard, CreatorEarning, CreatorEligibility, CreatorStatus, DashboardPeriod, RevenueRules, WithdrawalRecord } from "@/types/creator.type";

import { createIdempotencyKey, sendRequestToStudioServer } from "./clientApi.service";

export const creatorService = {
  fetchStatus: () => sendRequestToStudioServer<CreatorStatus>("/api/v1/creators/me"),
  fetchDashboard: (period: DashboardPeriod) => sendRequestToStudioServer<CreatorDashboard>("/api/v1/creators/dashboard", { query: { period } }),
  fetchRevenueRules: () => sendRequestToStudioServer<RevenueRules>("/api/v1/creators/revenue-rules"),
  listEarnings: (cursor?: string) => sendRequestToStudioServer<Page<CreatorEarning>>("/api/v1/creators/earnings", { query: { cursor, limit: 20 } }),
  fetchEligibility: () => sendRequestToStudioServer<CreatorEligibility>("/api/v1/creators/eligibility"),
  fetchMyApplication: () => sendRequestToStudioServer<CreatorApplication | null>("/api/v1/creators/applications/me"),
  listBrandDeals: () => sendRequestToStudioServer<Page<BrandDeal>>("/api/v1/creators/brand-deals"),
  recordBrandDeal: (input: BrandDealInput) => sendRequestToStudioServer<BrandDeal>("/api/v1/creators/brand-deals", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("deal") }),
  removeBrandDeal: (dealId: string) => sendRequestToStudioServer<void>(`/api/v1/creators/brand-deals/${encodeURIComponent(dealId)}`, { method: "DELETE" }),
  listWithdrawals: () => sendRequestToStudioServer<Page<WithdrawalRecord>>("/api/v1/wallets/me/withdrawals", { query: { limit: 10 } }),
};
