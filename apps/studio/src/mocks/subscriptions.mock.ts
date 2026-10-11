import { ApiError } from "@/errors/api.error";
import type { PriceTier, Subscriber, SubscriptionPlan } from "@/types/audience.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const ngn = (amountMinor: number) => ({ amountMinor, currency: "NGN" });
const tierLadder = [150_000, 300_000, 500_000, 1_000_000];
const grossUp = (amount: number, bps: number) => Math.ceil(amount / (1 - bps / 10_000) / 100) * 100;

let plans: SubscriptionPlan[] = [
  { id: "plan_1", name: "Inner circle", description: "Subscriber-only clips and a badge in my lives.", price: ngn(300_000), interval: "month", benefits: ["Subscriber badge", "Subscriber-only clips"], subscriberCount: 2, active: true },
];

const subscribers: readonly Subscriber[] = [
  { id: "sub_1", user: { id: "u_kemi", name: "Kemi Ade", username: "kemi", avatarUrl: null }, planId: "plan_1", planName: "Inner circle", since: daysAgo(40), renewsAt: daysAgo(-20), status: "active" },
  { id: "sub_2", user: { id: "u_chidi", name: "Chidi Okafor", username: "chidi", avatarUrl: null }, planId: "plan_1", planName: "Inner circle", since: daysAgo(9), renewsAt: null, status: "cancelled" },
];

export const subscriptionsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/creators/me/subscription-plans", () => ({ data: plans, nextCursor: null })),
  createMockRoute("GET", "/api/v1/creators/me/subscription-plans/price-tiers", ({ query }): { data: PriceTier[]; nextCursor: null } => {
    const currency = (query.get("currency") ?? "").toUpperCase();
    if (currency !== "NGN") throw new ApiError(422, "Creator subscriptions are not priced in this currency yet.", "CURRENCY_NOT_PRICED");
    const multiplier = query.get("interval") === "year" ? 10 : 1;
    return {
      data: tierLadder.map((amount, index) => ({ tier: `tier_${index + 1}`, default: index === 1, prices: { web: ngn(amount * multiplier), ios: ngn(grossUp(amount * multiplier, 3000)), android: ngn(grossUp(amount * multiplier, 1500)) } })),
      nextCursor: null,
    };
  }),
  createMockRoute("POST", "/api/v1/creators/me/subscription-plans", ({ body }) => {
    const input = (body ?? {}) as Partial<SubscriptionPlan>;
    if (!input.name?.trim()) throw new ApiError(400, "name must be 1-80 characters", "VALIDATION_FAILED");
    if (!input.price || input.price.amountMinor < 50_000) throw new ApiError(400, "price.amountMinor is below the minimum", "VALIDATION_FAILED");
    const plan: SubscriptionPlan = { id: `plan_${Date.now()}`, name: input.name.trim(), description: input.description ?? "", price: input.price, interval: input.interval ?? "month", benefits: input.benefits ?? [], subscriberCount: 0, active: true };
    plans = [...plans, plan];
    return plan;
  }),
  createMockRoute("PATCH", "/api/v1/creators/me/subscription-plans/:planId", ({ params, body }) => {
    const existing = plans.find((plan) => plan.id === params.planId);
    if (!existing) throw new ApiError(404, "That plan no longer exists.", "PLAN_NOT_FOUND");
    const updated = { ...existing, active: typeof (body as { active?: unknown })?.active === "boolean" ? Boolean((body as { active: boolean }).active) : existing.active };
    plans = plans.map((plan) => (plan.id === updated.id ? updated : plan));
    return updated;
  }),
  createMockRoute("GET", "/api/v1/creators/me/subscribers", () => ({ data: subscribers, nextCursor: null })),
];
