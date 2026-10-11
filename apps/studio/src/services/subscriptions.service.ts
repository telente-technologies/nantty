import type { Page } from "@/types";
import type { NewSubscriptionPlan, PriceTier, Subscriber, SubscriptionPlan } from "@/types/audience.type";

import { createIdempotencyKey, sendRequestToStudioServer } from "./clientApi.service";

const base = "/api/v1/creators/me/subscription-plans";

export const subscriptionsService = {
  listPlans: async () => (await sendRequestToStudioServer<Page<SubscriptionPlan>>(base)).data,
  listPriceTiers: async (currency: string, interval: "month" | "year") => (await sendRequestToStudioServer<Page<PriceTier>>(`${base}/price-tiers`, { query: { currency, interval } })).data,
  createPlan: (plan: NewSubscriptionPlan) => sendRequestToStudioServer<SubscriptionPlan>(base, { method: "POST", body: plan, idempotencyKey: createIdempotencyKey("plan") }),
  setPlanActive: (planId: string, active: boolean) => sendRequestToStudioServer<SubscriptionPlan>(`${base}/${encodeURIComponent(planId)}`, { method: "PATCH", body: { active } }),
  listSubscribers: async () => (await sendRequestToStudioServer<Page<Subscriber>>("/api/v1/creators/me/subscribers")).data,
};
