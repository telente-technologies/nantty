import { ApiError } from "@/errors/api.error";
import type { CreatorRevenueRules, CreatorSubscriber, CreatorSubscriptionPlan, CreatorSubscriptionPlanInput, CreatorSubscriptionState } from "@/types/creator.type";

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
const subscribedCreatorIdsByViewerId = new Map<string, Set<string>>();

export const hasSignedInViewerSubscribedToCreator = (creatorId: string) =>
  subscribedCreatorIdsByViewerId.get(getSignedInMockUser().id)?.has(creatorId) ?? false;

const presentPlan = (plan: MockPlan): CreatorSubscriptionPlan => ({
  id: plan.id,
  name: plan.name,
  price: convertUsdCentsToViewerCurrency(plan.usdCents),
  interval: plan.interval,
  benefits: plan.benefits,
  subscriberCount: plan.subscriberCount,
  active: plan.active,
});

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
    return plans.filter((plan) => plan.creatorId === getSignedInMockUser().id).map(presentPlan);
  }),
  createMockRoute("POST", "/api/v1/creators/me/subscription-plans", ({ body }) => {
    requireCreator();
    const input = body as CreatorSubscriptionPlanInput;
    if (!input.name.trim() || input.price.amountMinor <= 0) throw new ApiError(422, "Add a name and price");
    const plan: MockPlan = { id: `plan_${Date.now()}`, creatorId: getSignedInMockUser().id, name: input.name.trim(), usdCents: convertViewerMoneyToUsdCents(input.price), interval: input.interval, benefits: input.benefits, subscriberCount: 0, active: true };
    plans.push(plan);
    return presentPlan(plan);
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
  createMockRoute("GET", "/api/v1/creators/:creatorId/subscription-plans", ({ params }) =>
    plans.filter((plan) => plan.creatorId === params.creatorId && plan.active).map(presentPlan),
  ),
  createMockRoute("POST", "/api/v1/creators/:creatorId/subscriptions", ({ params, body }) => {
    const { planId } = body as { planId: string };
    const plan = plans.find((candidate) => candidate.id === planId && candidate.creatorId === params.creatorId);
    if (!plan) throw new ApiError(404, "Plan not found");
    const subscriptionId = `subs_${Date.now()}`;
    subscriptionStates.set(subscriptionId, { subscriptionId, creatorId: plan.creatorId, status: "active", planId, renewsAt: isoDateHoursAgo(plan.interval === "month" ? -720 : -8760) });
    plan.subscriberCount += 1;
    const viewerId = getSignedInMockUser().id;
    subscribedCreatorIdsByViewerId.set(viewerId, new Set([...(subscribedCreatorIdsByViewerId.get(viewerId) ?? []), plan.creatorId]));
    return { subscriptionId, reference: subscriptionId, provider: "paystack", accessCode: "", authorizationUrl: `/subscriptions/return?subscriptionId=${subscriptionId}` };
  }),
  createMockRoute("GET", "/api/v1/creator-subscriptions", () => ({ data: [...subscriptionStates.values()], nextCursor: null })),
  createMockRoute("GET", "/api/v1/subscriptions/:subscriptionId", ({ params }) => {
    const state = subscriptionStates.get(params.subscriptionId!);
    if (!state) throw new ApiError(404, "Subscription not found");
    return state;
  }),
];
