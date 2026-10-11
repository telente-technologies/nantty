import { ApiError } from "@/errors/api.error";
import type { Boost, BoostEstimate, BoostEstimateRequest, BoostOptions, CreateBoostRequest, FreeBoostAllowance } from "@/types/boost.type";

import { getSignedInMockUser, signedInUserIsTheDemoSeller } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const MINIMUM_DAILY_BUDGET_USD_CENTS = 100;
const REACH_PER_USD_CENT = 3.2;

const FREE_BOOSTS_PER_MONTH = 1;
const FREE_BOOST_MAX_USD_CENTS = MINIMUM_DAILY_BUDGET_USD_CENTS;
const freeBoostsUsedByUserMonth = new Map<string, number>();

const signedInUserHasPremium = () => getSignedInMockUser().verification?.tier === "PREMIUM" || signedInUserIsTheDemoSeller();
const freeBoostUsageKey = () => `${getSignedInMockUser().id}:${new Date().toISOString().slice(0, 7)}`;

const buildFreeBoost = (): FreeBoostAllowance => {
  const premium = signedInUserHasPremium();
  const remaining = premium ? Math.max(0, FREE_BOOSTS_PER_MONTH - (freeBoostsUsedByUserMonth.get(freeBoostUsageKey()) ?? 0)) : 0;
  const now = new Date();
  return {
    premium,
    eligible: premium && remaining > 0,
    remainingThisMonth: remaining,
    maxTotal: convertUsdCentsToViewerCurrency(FREE_BOOST_MAX_USD_CENTS),
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
};

const buildOptions = (): BoostOptions => ({
  paymentMethods: signedInUserHasPremium() ? ["card", "free"] : ["card"],
  freeBoost: buildFreeBoost(),
  minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
  suggestedDailyBudgets: [100, 300, 700, 1_500].map(convertUsdCentsToViewerCurrency),
  durationDayOptions: [1, 3, 7, 14],
  interests: ["Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"],
  packages: [[1, 1, "1 day"], [3, 3, "3 days"], [7, 7, "1 week"], [15, 7, "1 week, wider reach"]].map(([multiple, days, label]) => {
    const price = convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS * Number(multiple));
    const reachMid = Math.round(MINIMUM_DAILY_BUDGET_USD_CENTS * Number(multiple) * REACH_PER_USD_CENT);
    return { priceMinor: price.amountMinor, currency: price.currency, days: Number(days), label: String(label), estimatedReach: { low: Math.round(reachMid * 0.8), high: Math.round(reachMid * 1.25) }, impressions: { low: reachMid, high: Math.round(reachMid * 1.8) } };
  }),
});

const estimate = (request: BoostEstimateRequest): BoostEstimate => {
  const dailyUsdCents = convertViewerMoneyToUsdCents(request.dailyBudget);
  if (dailyUsdCents < MINIMUM_DAILY_BUDGET_USD_CENTS) throw new ApiError(422, "Your daily budget is below the minimum");
  const totalUsdCents = dailyUsdCents * request.durationDays;
  const narrowing = request.audience.mode === "custom" ? 0.7 : 1;
  const reachMid = Math.round(totalUsdCents * REACH_PER_USD_CENT * narrowing);
  const results = { views: `${Math.round(reachMid * 1.4).toLocaleString()} views`, profile_visits: `${Math.round(reachMid * 0.04).toLocaleString()} profile visits`, messages: `${Math.max(1, Math.round(reachMid * 0.006))} messages` };
  const totalCost = convertUsdCentsToViewerCurrency(totalUsdCents);
  const clicks = { low: Math.round(reachMid * 0.01), high: Math.round(reachMid * 0.025) };
  return {
    estimatedReachMin: Math.round(reachMid * 0.8), estimatedReachMax: Math.round(reachMid * 1.25), estimatedResultsLabel: `About ${results[request.goal]}`, totalCost,
    impressions: { low: reachMid, high: Math.round(reachMid * 1.8) }, clicks, costPerResultMinor: { low: Math.floor(totalCost.amountMinor / Math.max(clicks.high, 1)), high: Math.ceil(totalCost.amountMinor / Math.max(clicks.low, 1)) },
    minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
  };
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
    paymentMethod: record.request.paymentMethod,
  };
};

export const boostsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/ads/boosts/options", () => buildOptions()),
  createMockRoute("POST", "/api/v1/ads/boosts/estimate", ({ body }) => estimate(body as BoostEstimateRequest)),
  createMockRoute("POST", "/api/v1/ads/boosts", ({ body }) => {
    const request = body as CreateBoostRequest;
    const totalCost = estimate(request).totalCost;
    const total = convertViewerMoneyToUsdCents(totalCost);
    if (request.paymentMethod === "balance") throw new ApiError(403, "Paying from your balance isn't available in the app.", "PAYMENT_METHOD_NOT_AVAILABLE_IN_APP");
    if (request.paymentMethod === "free") {
      const free = buildFreeBoost();
      if (!free.premium) throw new ApiError(403, "Free boosts come with Premium.", "FREE_BOOST_NOT_AVAILABLE");
      if (free.remainingThisMonth <= 0) throw new ApiError(409, "You've already used this month's free boost.", "FREE_BOOST_USED");
      if (totalCost.amountMinor > free.maxTotal.amountMinor) throw new ApiError(422, "This boost is bigger than your free boost covers.", "FREE_BOOST_TOO_LARGE");
      freeBoostsUsedByUserMonth.set(freeBoostUsageKey(), (freeBoostsUsedByUserMonth.get(freeBoostUsageKey()) ?? 0) + 1);
    }
    const record: MockBoost = { id: `bst_${Date.now()}`, request, totalUsdCents: total, createdAt: Date.now() };
    boosts.set(record.id, record);
    return { boost: presentBoost(record), checkoutUrl: request.paymentMethod === "card" ? `https://checkout.flutterwave.com/v3/hosted/pay/mock-boost-${record.id}` : null };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId", ({ params }) => {
    const record = boosts.get(params.boostId!);
    if (!record) throw new ApiError(404, "Boost not found");
    return presentBoost(record);
  }),
];
