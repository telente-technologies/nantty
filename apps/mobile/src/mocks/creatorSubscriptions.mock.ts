import { ApiError } from "@/errors/api.error";
import type {
  CreatorBillingChannel,
  CreatorRevenueRules,
  CreatorSubscriber,
  CreatorSubscriptionPlan,
  CreatorSubscriptionPlanInput,
  CreatorSubscriptionPriceTier,
  CreatorSubscriptionState,
} from "@/types/creator.type";

import { signedInUserIsApprovedCreator } from "./creatorFixtures.mock";
import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { userSummaryById } from "./userDirectory.mock";

const REVENUE_RULES: CreatorRevenueRules = {
  giftCreatorSharePercentUpTo: 70,
  adsRevenueCreatorSharePercent: 40,
  coinTransferPlatformFeePercent: 25,
  affiliateCommissionReleasedAfterEscrow: true,
  withdrawalFeeDescription: "Withdrawals carry the payment provider's transfer fee, shown before you confirm.",
};

interface MockPlan {
  readonly id: string;
  readonly creatorId: string;
  readonly name: string;
  readonly usdCents: number;
  readonly interval: "month" | "year";
  readonly benefits: readonly string[];
  subscriberCount: number;
  active: boolean;
}

const plans: MockPlan[] = [
  { id: "plan_1", creatorId: "u_me", name: "Kitchen Circle", usdCents: 300, interval: "month", benefits: ["Subscriber-only recipe lives", "Early access to new pots", "Monthly discount code"], subscriberCount: 86, active: true },
  { id: "plan_2", creatorId: "u_me", name: "Home Insiders", usdCents: 3_000, interval: "year", benefits: ["Everything in Kitchen Circle", "Free delivery once a quarter"], subscriberCount: 12, active: true },
  { id: "plan_3", creatorId: "u_13", name: "Amaka's Besties", usdCents: 400, interval: "month", benefits: ["Behind-the-scenes clips", "Subscriber badge in lives", "Monthly GRWM Q&A"], subscriberCount: 2_310, active: true },
  { id: "plan_5", creatorId: "u_9", name: "Kelechi's Studio Pass", usdCents: 300, interval: "month", benefits: ["Behind-the-scenes shoot clips", "Monthly editing walkthrough"], subscriberCount: 418, active: true },
  { id: "plan_6", creatorId: "u_10", name: "Jollof Tasting Club", usdCents: 200, interval: "month", benefits: ["Subscriber-only food reviews", "Early restaurant picks"], subscriberCount: 1_120, active: true },
  { id: "plan_4", creatorId: "u_12", name: "Coach Segun Crew", usdCents: 500, interval: "month", benefits: ["Weekly workout plans", "Live form checks"], subscriberCount: 640, active: true },
];

const subscriptionStates = new Map<string, CreatorSubscriptionState>();
const subscriptionIdByReference = new Map<string, string>();
const subscribedCreatorIdsByViewerId = new Map<string, Set<string>>();

const renewsAtFor = (plan: MockPlan) => isoDateHoursAgo(plan.interval === "month" ? -720 : -8760);

const presentState = (subscriptionId: string, plan: MockPlan, status: CreatorSubscriptionState["status"]): CreatorSubscriptionState => ({
  subscriptionId,
  creatorId: plan.creatorId,
  planId: plan.id,
  status,
  price: convertUsdCentsToViewerCurrency(plan.usdCents),
  interval: plan.interval,
  currentPeriodEnd: renewsAtFor(plan),
  renewsAt: status === "active" ? renewsAtFor(plan) : null,
});

export const hasSignedInViewerSubscribedToCreator = (creatorId: string) =>
  subscribedCreatorIdsByViewerId.get(getSignedInMockUser().id)?.has(creatorId) ?? false;

const STORE_FEE_PERCENT: Record<CreatorBillingChannel, number> = { web: 0, ios: 30, android: 15 };
const TIER_USD_CENTS = [199, 499, 749, 999, 1_499, 1_799, 1_999];
const TIER_KEYS = ["500", "1000", "1500", "2000", "3000", "4000", "5000"];

const grossUp = (usdCents: number, channel: CreatorBillingChannel) => Math.ceil(usdCents / (1 - STORE_FEE_PERCENT[channel] / 100));

const presentPlan = (plan: MockPlan, channel: CreatorBillingChannel = "web"): CreatorSubscriptionPlan => ({
  id: plan.id,
  name: plan.name,
  price: convertUsdCentsToViewerCurrency(plan.usdCents),
  interval: plan.interval,
  benefits: plan.benefits,
  subscriberCount: plan.subscriberCount,
  active: plan.active,
  tier: "1000",
  channel,
  channelPrice: convertUsdCentsToViewerCurrency(grossUp(plan.usdCents, channel)),
  storeProductId: channel === "web" ? null : `nantty.creatorsub.tier_1000.s1.${plan.interval === "month" ? "monthly" : "yearly"}`,
});

const priceTiers = (interval: "month" | "year"): CreatorSubscriptionPriceTier[] =>
  TIER_USD_CENTS.map((usdCents, index) => {
    const base = interval === "year" ? usdCents * 10 : usdCents;
    return {
      tier: TIER_KEYS[index]!,
      default: index === 1,
      prices: { web: convertUsdCentsToViewerCurrency(base), ios: convertUsdCentsToViewerCurrency(grossUp(base, "ios")), android: convertUsdCentsToViewerCurrency(grossUp(base, "android")) },
    };
  });

const recordSubscription = (plan: MockPlan, status: CreatorSubscriptionState["status"], billingChannel: CreatorSubscriptionState["billingChannel"]) => {
  const subscriptionId = `subs_${Date.now()}`;
  const state: CreatorSubscriptionState = { ...presentState(subscriptionId, plan, status), billingChannel };
  subscriptionStates.set(subscriptionId, state);
  if (status === "active") {
    plan.subscriberCount += 1;
    const viewerId = getSignedInMockUser().id;
    subscribedCreatorIdsByViewerId.set(viewerId, new Set([...(subscribedCreatorIdsByViewerId.get(viewerId) ?? []), plan.creatorId]));
  }
  return state;
};

const subscribers = (): CreatorSubscriber[] =>
  (["u_10", "u_17", "u_20", "u_7", "u_11"] as const).map((userId, index) => ({
    id: `sub_${userId}`,
    user: userSummaryById(userId),
    planName: index === 1 ? "Home Insiders" : "Kitchen Circle",
    since: isoDateHoursAgo(200 + index * 170),
    renewsAt: isoDateHoursAgo(-(48 + index * 90)),
  }));

const requireCreator = () => {
  if (!signedInUserIsApprovedCreator()) throw new ApiError(403, "Join the Creator Program first", "CREATOR_PROGRAM_REQUIRED");
};

export const creatorSubscriptionsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/creators/revenue-rules", () => REVENUE_RULES),
  createMockRoute("GET", "/api/v1/creators/me/subscription-plans", () => {
    requireCreator();
    return plans.filter((plan) => plan.creatorId === getSignedInMockUser().id).map((plan) => presentPlan(plan));
  }),
  createMockRoute("POST", "/api/v1/creators/me/subscription-plans", ({ body }) => {
    requireCreator();
    const input = body as CreatorSubscriptionPlanInput;
    if (!input.name.trim() || input.price.amountMinor <= 0) throw new ApiError(422, "Add a name and price");
    const plan: MockPlan = { id: `plan_${Date.now()}`, creatorId: getSignedInMockUser().id, name: input.name.trim(), usdCents: convertViewerMoneyToUsdCents(input.price), interval: input.interval, benefits: input.benefits, subscriberCount: 0, active: true };
    plans.push(plan);
    return presentPlan(plan);
  }),
  createMockRoute("GET", "/api/v1/creators/me/subscription-plans/price-tiers", ({ query }) => {
    requireCreator();
    return priceTiers(query.get("interval") === "year" ? "year" : "month");
  }),
  createMockRoute("PATCH", "/api/v1/creators/me/subscription-plans/:planId", ({ params, body }) => {
    const plan = plans.find((candidate) => candidate.id === params.planId && candidate.creatorId === getSignedInMockUser().id);
    if (!plan) throw new ApiError(404, "Plan not found");
    plan.active = (body as { active: boolean }).active;
    return presentPlan(plan);
  }),
  createMockRoute("GET", "/api/v1/creators/me/subscribers", () => {
    requireCreator();
    return subscribers();
  }),
  createMockRoute("GET", "/api/v1/creators/:creatorId/subscription-plans", ({ params, query }) => {
    const channel = (["ios", "android"] as const).find((candidate) => candidate === query.get("channel")) ?? "web";
    return plans.filter((plan) => plan.creatorId === params.creatorId && plan.active).map((plan) => presentPlan(plan, channel));
  }),
  createMockRoute("POST", "/api/v1/creators/:creatorId/subscriptions/store", ({ params, body }) => {
    const { planId, platform } = body as { planId: string; platform: "ios" | "android" };
    const plan = plans.find((candidate) => candidate.id === planId && candidate.creatorId === params.creatorId);
    if (!plan) throw new ApiError(404, "Plan not found");
    const presented = presentPlan(plan, platform);
    const state = recordSubscription(plan, "pending", platform === "ios" ? "apple_iap" : "google_play");
    return { subscriptionId: state.subscriptionId, platform, productId: presented.storeProductId, appAccountToken: state.subscriptionId, obfuscatedAccountId: state.subscriptionId, channelPrice: presented.channelPrice, subscription: state };
  }),
  createMockRoute("POST", "/api/v1/creator-subscriptions/store-receipts", ({ body }) => {
    const { productId } = body as { productId: string };
    const pending = [...subscriptionStates.values()].find((state) => state.status === "pending" && state.billingChannel !== "web");
    if (!pending || !productId.startsWith("nantty.creatorsub.")) throw new ApiError(422, "This purchase isn't linked to a creator subscription.", "STORE_PURCHASE_NOT_LINKED");
    const active: CreatorSubscriptionState = { ...pending, status: "active", storeProductId: productId };
    subscriptionStates.set(active.subscriptionId, active);
    const viewerId = getSignedInMockUser().id;
    subscribedCreatorIdsByViewerId.set(viewerId, new Set([...(subscribedCreatorIdsByViewerId.get(viewerId) ?? []), active.creatorId]));
    return active;
  }),
  createMockRoute("POST", "/api/v1/creators/:creatorId/subscriptions", ({ params, body }) => {
    const { planId } = body as { planId: string };
    const plan = plans.find((candidate) => candidate.id === planId && candidate.creatorId === params.creatorId);
    if (!plan) throw new ApiError(404, "Plan not found");
    const subscriptionId = `subs_${Date.now()}`;
    const reference = `creator-sub_${Date.now()}`;
    const state = presentState(subscriptionId, plan, "active");
    subscriptionStates.set(subscriptionId, state);
    subscriptionIdByReference.set(reference, subscriptionId);
    plan.subscriberCount += 1;
    const viewerId = getSignedInMockUser().id;
    subscribedCreatorIdsByViewerId.set(viewerId, new Set([...(subscribedCreatorIdsByViewerId.get(viewerId) ?? []), plan.creatorId]));
    return { subscriptionId, checkoutUrl: `https://checkout.flutterwave.com/v3/hosted/pay/mock-subscription-${subscriptionId}`, reference, subscription: state };
  }),
  createMockRoute("GET", "/api/v1/creator-subscriptions", () => [...subscriptionStates.values()]),
  createMockRoute("POST", "/api/v1/creator-subscriptions/verify", ({ body }) => {
    const { reference } = body as { reference: string };
    const subscriptionId = subscriptionIdByReference.get(reference);
    const state = subscriptionId ? subscriptionStates.get(subscriptionId) : undefined;
    if (!state) throw new ApiError(404, "Subscription payment not found");
    return state;
  }),
  createMockRoute("GET", "/api/v1/creator-subscriptions/:id", ({ params }) => {
    const state = subscriptionStates.get(params.id!);
    if (!state) throw new ApiError(404, "Subscription not found");
    return state;
  }),
  createMockRoute("POST", "/api/v1/creator-subscriptions/:id/cancel", ({ params }) => {
    const state = subscriptionStates.get(params.id!);
    if (!state) throw new ApiError(404, "Subscription not found");
    const updated: CreatorSubscriptionState = { ...state, status: "cancelled", renewsAt: null };
    subscriptionStates.set(state.subscriptionId, updated);
    return updated;
  }),
  createMockRoute("POST", "/api/v1/creator-subscriptions/:id/resume", ({ params }) => {
    const state = subscriptionStates.get(params.id!);
    if (!state) throw new ApiError(404, "Subscription not found");
    const updated: CreatorSubscriptionState = { ...state, status: "active", renewsAt: state.currentPeriodEnd };
    subscriptionStates.set(state.subscriptionId, updated);
    return updated;
  }),
];
