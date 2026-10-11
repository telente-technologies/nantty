import type {
  CreatorApplication,
  CreatorApplicationInput,
  CreatorDashboard,
  CreatorDashboardPeriod,
  CreatorEarning,
  CreatorEligibility,
  CreatorRevenueRules,
  CreatorSubscriber,
  CreatorSubscriptionPlan,
  CreatorSubscriptionPlanInput,
  CreatorSubscriptionPriceTier,
} from "@/types/creator.type";
import type { Page as GenericPage } from "@/types";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const creatorProgramService = {
  fetchCreatorDashboard: (period: CreatorDashboardPeriod) =>
    sendRequestToWebappServer<CreatorDashboard>("/api/v1/creators/dashboard", { query: { period } }),
  fetchMyCreatorEligibility: () => sendRequestToWebappServer<CreatorEligibility>("/api/v1/creators/eligibility"),
  fetchMyCreatorApplication: () => sendRequestToWebappServer<CreatorApplication | null>("/api/v1/creators/applications/me"),
  submitCreatorApplication: (input: CreatorApplicationInput) =>
    sendRequestToWebappServer<CreatorApplication>("/api/v1/creators/applications", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("creator-apply") }),
  fetchCreatorRevenueRules: () => sendRequestToWebappServer<CreatorRevenueRules>("/api/v1/creators/revenue-rules"),
  fetchCreatorEarningsPage: (cursor: string | null) =>
    sendRequestToWebappServer<GenericPage<CreatorEarning>>("/api/v1/creators/earnings", { query: { cursor: cursor ?? undefined } }),
  listMyCreatorEarnings: () => sendListRequestToWebappServer<CreatorEarning>("/api/v1/creators/earnings"),
  listMySubscriptionPlans: () => sendListRequestToWebappServer<CreatorSubscriptionPlan>("/api/v1/creators/me/subscription-plans"),
  createMySubscriptionPlan: (input: CreatorSubscriptionPlanInput, idempotencyKey: string) =>
    sendRequestToWebappServer<CreatorSubscriptionPlan>("/api/v1/creators/me/subscription-plans", { method: "POST", body: input, idempotencyKey }),
  setMySubscriptionPlanActive: (planId: string, active: boolean) =>
    sendRequestToWebappServer<CreatorSubscriptionPlan>(`/api/v1/creators/me/subscription-plans/${encodeURIComponent(planId)}`, { method: "PATCH", body: { active } }),
  listMySubscribers: () => sendListRequestToWebappServer<CreatorSubscriber>("/api/v1/creators/me/subscribers"),
  listMySubscriptionPriceTiers: (currency: string, interval: "month" | "year") =>
    sendListRequestToWebappServer<CreatorSubscriptionPriceTier>("/api/v1/creators/me/subscription-plans/price-tiers", { query: { currency, interval } }),
};

export type { CreatorApplication, CreatorApplicationInput, CreatorEligibility, CreatorRevenueRules };
