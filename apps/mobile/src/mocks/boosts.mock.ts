import { ApiError } from "@/errors/api.error";
import type { Boost, BoostEstimate, BoostEstimateRequest, BoostOptions, CreateBoostRequest } from "@/types/boost.type";

import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const MINIMUM_DAILY_BUDGET_USD_CENTS = 100;
const REACH_PER_USD_CENT = 3.2;

const buildOptions = (): BoostOptions => ({
  minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
  suggestedDailyBudgets: [100, 300, 700, 1_500].map(convertUsdCentsToViewerCurrency),
  durationDayOptions: [1, 3, 7, 14],
  interests: ["Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"],
});

const estimate = (request: BoostEstimateRequest): BoostEstimate => {
  const dailyUsdCents = convertViewerMoneyToUsdCents(request.dailyBudget);
  if (dailyUsdCents < MINIMUM_DAILY_BUDGET_USD_CENTS) throw new ApiError(422, "Your daily budget is below the minimum");
  const totalUsdCents = dailyUsdCents * request.durationDays;
  const narrowing = request.audience.mode === "custom" ? 0.7 : 1;
  const reachMid = Math.round(totalUsdCents * REACH_PER_USD_CENT * narrowing);
  const results = { views: `${Math.round(reachMid * 1.4).toLocaleString()} views`, profile_visits: `${Math.round(reachMid * 0.04).toLocaleString()} profile visits`, messages: `${Math.max(1, Math.round(reachMid * 0.006))} messages` };
  return { estimatedReachMin: Math.round(reachMid * 0.8), estimatedReachMax: Math.round(reachMid * 1.25), estimatedResultsLabel: `About ${results[request.goal]}`, totalCost: convertUsdCentsToViewerCurrency(totalUsdCents) };
};

interface MockBoost { readonly id: string; readonly request: CreateBoostRequest; readonly totalUsdCents: number; readonly createdAt: number }
const boosts = new Map<string, MockBoost>();

const presentBoost = (record: MockBoost): Boost => {
  const hoursRunning = Math.max(0, (Date.now() - record.createdAt) / 3_600_000);
  const progress = Math.min(1, 0.15 + hoursRunning / (record.request.durationDays * 24));
  const reach = Math.round(record.totalUsdCents * REACH_PER_USD_CENT * progress);
  return {
    id: record.id,
    postId: record.request.postId,
    status: progress >= 1 ? "completed" : "active",
    goal: record.request.goal,
    totalBudget: convertUsdCentsToViewerCurrency(record.totalUsdCents),
    spent: convertUsdCentsToViewerCurrency(Math.round(record.totalUsdCents * progress)),
    startsAt: new Date(record.createdAt).toISOString(),
    endsAt: new Date(record.createdAt + record.request.durationDays * 86_400_000).toISOString(),
    results: { impressions: Math.round(reach * 1.6), reach, profileVisits: Math.round(reach * 0.04), messages: Math.round(reach * 0.006) },
    rejectionReason: null,
  };
};

export const boostsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/ads/boosts/options", () => buildOptions()),
  createMockRoute("POST", "/api/v1/ads/boosts/estimate", ({ body }) => estimate(body as BoostEstimateRequest)),
  createMockRoute("POST", "/api/v1/ads/boosts", ({ body }) => {
    const request = body as CreateBoostRequest;
    const total = convertViewerMoneyToUsdCents(estimate(request).totalCost);
    const record: MockBoost = { id: `bst_${Date.now()}`, request, totalUsdCents: total, createdAt: Date.now() };
    boosts.set(record.id, record);
    return { boost: presentBoost(record), checkoutUrl: request.paymentMethod === "card" ? `https://checkout.paystack.com/mock-boost/${record.id}` : null };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId", ({ params }) => {
    const record = boosts.get(params.boostId!);
    if (!record) throw new ApiError(404, "Boost not found");
    return presentBoost(record);
  }),
];
