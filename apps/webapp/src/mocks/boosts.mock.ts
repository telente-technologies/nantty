import { ApiError } from "@/errors/api.error";
import type { Boost, BoostEstimate, BoostEstimateRequest, BoostOptions, CreateBoostRequest } from "@/types/boost.type";
import type { Money } from "@/types/money.type";

import { getSignedInMockUser, signedInUserIsTheDemoSeller } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildWalletSummary, signedInUserIsPayoutVerified } from "./wallet.mock";

const MINIMUM_DAILY_BUDGET_USD_CENTS = 100;
const REACH_PER_USD_CENT = 3.2;
const FREE_BOOST_MAX_TOTAL_USD_CENTS = 700;
const freeBoostsUsedByUserId = new Map<string, number>();

const nextMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
};

const buildFreeBoost = () => {
  const premium = signedInUserIsTheDemoSeller();
  const remainingThisMonth = premium ? Math.max(0, 1 - (freeBoostsUsedByUserId.get(getSignedInMockUser().id) ?? 0)) : 0;
  return { premium, eligible: premium && remainingThisMonth > 0, remainingThisMonth, maxTotal: convertUsdCentsToViewerCurrency(FREE_BOOST_MAX_TOTAL_USD_CENTS), resetsAt: nextMonthStart() };
};

const buildOptions = (): BoostOptions => ({
  minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
  suggestedDailyBudgets: [100, 300, 700, 1_500].map(convertUsdCentsToViewerCurrency),
  durationDayOptions: [1, 3, 7, 14],
  interests: ["Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"],
  paymentMethods: signedInUserIsTheDemoSeller() ? ["card", "balance", "free"] : ["card", "balance"],
  freeBoost: buildFreeBoost(),
});

const chargeOrThrow = (request: CreateBoostRequest, totalCost: Money) => {
  if (request.paymentMethod === "free") {
    const freeBoost = buildFreeBoost();
    if (!freeBoost.premium) throw new ApiError(403, "Free boosts are included with Premium.", "FREE_BOOST_NOT_AVAILABLE");
    if (freeBoost.remainingThisMonth <= 0) throw new ApiError(409, "You have already used this month's free boost.", "FREE_BOOST_USED");
    if (totalCost.amountMinor > freeBoost.maxTotal.amountMinor) throw new ApiError(422, "This boost is larger than your free boost allows.", "FREE_BOOST_TOO_LARGE");
    const userId = getSignedInMockUser().id;
    freeBoostsUsedByUserId.set(userId, (freeBoostsUsedByUserId.get(userId) ?? 0) + 1);
    return;
  }
  if (request.paymentMethod === "balance") {
    if (!signedInUserIsPayoutVerified()) throw new ApiError(403, "Verify your payout details to use Zudomart Ads. Your verification keeps advertisers and creators safe.", "VERIFICATION_REQUIRED");
    if (totalCost.amountMinor > buildWalletSummary().available.amountMinor) throw new ApiError(422, "Amount is more than your available balance.", "INSUFFICIENT_FUNDS");
    return;
  }
  if (request.paymentMethod !== "card") throw new ApiError(422, "Choose how to pay for this boost.", "VALIDATION_FAILED");
};

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
    paymentMethod: record.request.paymentMethod,
  };
};

export const boostsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/ads/boosts/options", () => buildOptions()),
  createMockRoute("POST", "/api/v1/ads/boosts/estimate", ({ body }) => estimate(body as BoostEstimateRequest)),
  createMockRoute("POST", "/api/v1/ads/boosts", ({ body }) => {
    const request = body as CreateBoostRequest;
    const totalCost = estimate(request).totalCost;
    chargeOrThrow(request, totalCost);
    const total = convertViewerMoneyToUsdCents(totalCost);
    const record: MockBoost = { id: `bst_${Date.now()}`, request, totalUsdCents: total, createdAt: Date.now() };
    boosts.set(record.id, record);
    return { boost: presentBoost(record), checkoutUrl: request.paymentMethod === "card" ? `/pay/demo?reference=${record.id}&next=${encodeURIComponent(`/boost/status/${record.id}`)}` : null };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId", ({ params }) => {
    const record = boosts.get(params.boostId!);
    if (!record) throw new ApiError(404, "Boost not found");
    return presentBoost(record);
  }),
];
