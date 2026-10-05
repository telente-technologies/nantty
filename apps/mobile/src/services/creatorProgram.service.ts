import type { Page } from "@/types";
import type {
  CreatorAffiliation,
  CreatorAffiliationRequest,
  CreatorApplication,
  CreatorApplicationInput,
  CreatorDashboard,
  CreatorDashboardPeriod,
  CreatorEarning,
  CreatorEligibility,
  CreatorRevenueRules,
  CreatorSubscriber,
  CreatorSubscriptionCheckout,
  CreatorSubscriptionPlan,
  CreatorSubscriptionPlanInput,
  CreatorSubscriptionState,
} from "@/types/creator.type";

import { api } from "./apiClient.service";

export const creatorProgramService = {
  fetchMyCreatorEligibility: () => api.get<CreatorEligibility>("/api/v1/creators/eligibility"),
  fetchMyCreatorApplication: () => api.get<CreatorApplication | null>("/api/v1/creators/applications/me"),
  submitCreatorApplication: (input: CreatorApplicationInput, idempotencyKey: string) =>
    api.post<CreatorApplication>("/api/v1/creators/applications", input, { idempotencyKey }),
  fetchCreatorDashboard: (period: CreatorDashboardPeriod) => api.get<CreatorDashboard>("/api/v1/creators/dashboard", { period }),
  listMyAffiliations: () => api.getList<CreatorAffiliation>("/api/v1/creators/affiliations"),
  requestAffiliation: (request: CreatorAffiliationRequest) => api.post<CreatorAffiliation>("/api/v1/creators/affiliations", request),
  fetchCreatorEarningsPage: (cursor: string | null) =>
    api.get<Page<CreatorEarning>>("/api/v1/creators/earnings", { cursor: cursor ?? undefined }),
  fetchCreatorRevenueRules: () => api.get<CreatorRevenueRules>("/api/v1/creators/revenue-rules"),
  listMySubscriptionPlans: () => api.getList<CreatorSubscriptionPlan>("/api/v1/creators/me/subscription-plans"),
  createMySubscriptionPlan: (input: CreatorSubscriptionPlanInput) => api.post<CreatorSubscriptionPlan>("/api/v1/creators/me/subscription-plans", input),
  setMySubscriptionPlanActive: (planId: string, active: boolean) =>
    api.patch<CreatorSubscriptionPlan>(`/api/v1/creators/me/subscription-plans/${encodeURIComponent(planId)}`, { active }),
  listMySubscribers: () => api.getList<CreatorSubscriber>("/api/v1/creators/me/subscribers"),
  listSubscriptionPlansOfCreator: (creatorId: string) =>
    api.getList<CreatorSubscriptionPlan>(`/api/v1/creators/${encodeURIComponent(creatorId)}/subscription-plans`),
  startSubscriptionCheckout: (creatorId: string, planId: string, idempotencyKey: string) =>
    api.post<CreatorSubscriptionCheckout>(`/api/v1/creators/${encodeURIComponent(creatorId)}/subscriptions`, { planId }, { idempotencyKey }),
  verifySubscriptionCheckout: (reference: string) =>
    api.post<CreatorSubscriptionState>("/api/v1/creator-subscriptions/verify", { reference }),
  fetchSubscriptionState: (subscriptionId: string) => api.get<CreatorSubscriptionState>(`/api/v1/creator-subscriptions/${encodeURIComponent(subscriptionId)}`),
  listMySubscriptions: () => api.getList<CreatorSubscriptionState>("/api/v1/creator-subscriptions"),
  cancelSubscription: (subscriptionId: string) => api.post<CreatorSubscriptionState>(`/api/v1/creator-subscriptions/${encodeURIComponent(subscriptionId)}/cancel`),
  resumeSubscription: (subscriptionId: string) => api.post<CreatorSubscriptionState>(`/api/v1/creator-subscriptions/${encodeURIComponent(subscriptionId)}/resume`),
};
