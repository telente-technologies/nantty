import { ApiError } from "@/errors/api.error";
import type { Money } from "@/types";
import type { BrandDeal, CreatorDashboard, CreatorEarning, DashboardPeriod } from "@/types/creator.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const ngn = (amountMinor: number): Money => ({ amountMinor, currency: "NGN" });
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const periods: readonly DashboardPeriod[] = ["today", "week", "month", "all"];
const periodScale: Record<DashboardPeriod, number> = { today: 0.05, week: 0.3, month: 1, all: 3.2 };

function buildDashboard(period: DashboardPeriod): CreatorDashboard {
  const scale = periodScale[period];
  const gifts = Math.round(1_040_000 * scale);
  const subscriptions = Math.round(210_000 * scale);
  const affiliate = Math.round(45_000 * scale);
  return {
    period, since: period === "all" ? null : daysAgo(period === "today" ? 0 : period === "week" ? 7 : 30), currency: "NGN",
    earnings: { gifts: ngn(gifts), tips: ngn(Math.round(60_000 * scale)), affiliateCommissions: ngn(affiliate), subscriptions: ngn(subscriptions), adRevenue: ngn(0), bonuses: ngn(subscriptions), total: ngn(gifts + subscriptions + affiliate) },
    pendingBalance: ngn(340_000), availableBalance: ngn(1_250_000), followersGained: period === "all" ? 12_480 : 0,
    followers: { total: 12_480, gainedInPeriod: period === "all" ? 12_480 : null }, coins: { earned: 3_400 },
    topContent: [
      { id: "live_2", kind: "live", title: "Late night beats and freestyle with guests", thumbnailUrl: null, views: 0, earnings: ngn(Math.round(523_000 * scale)) },
      { id: "live_1", kind: "live", title: "Sunday pots restock — live from Ibadan", thumbnailUrl: null, views: 0, earnings: ngn(Math.round(184_000 * scale)) },
    ],
  };
}

const earnings: readonly CreatorEarning[] = [
  { id: "earn_1", kind: "gift", source: "live", description: "Gifts in Sunday pots restock", amount: ngn(184_000), grossAmount: ngn(368_000), status: "pending", availableAt: daysAgo(-3), createdAt: daysAgo(0), sourceRef: { type: "live", id: "live_1" } },
  { id: "earn_2", kind: "subscription", source: "subscription", description: "Inner circle subscription from @kemi", amount: ngn(105_000), grossAmount: ngn(150_000), status: "available", availableAt: daysAgo(2), createdAt: daysAgo(9), sourceRef: { type: "subscription", id: "sub_1" } },
  { id: "earn_3", kind: "affiliate", source: "order", description: "Commission on Clay Pot with Lid", amount: ngn(45_000), grossAmount: ngn(45_000), status: "available", availableAt: daysAgo(5), createdAt: daysAgo(12), sourceRef: { type: "order", id: "ord_9" } },
];

let brandDeals: BrandDeal[] = [
  { id: "deal_1", brandName: "Adire Lagos", amount: ngn(25_000_000), startsAt: daysAgo(14), endsAt: daysAgo(-16), disclosure: "Paid partnership with Adire Lagos", notes: "Two lives and one clip", createdAt: daysAgo(15) },
];

export const creatorMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/creators/me", () => ({ status: "approved", canGoLive: true, tier: "rising", giftSharePercent: 50, suspensionReason: null, suspendedAt: null, recentViolations: 0 })),
  createMockRoute("GET", "/api/v1/creators/dashboard", ({ query }) => {
    const period = (query.get("period") ?? "month") as DashboardPeriod;
    if (!periods.includes(period)) throw new ApiError(400, "period is not an allowed value", "VALIDATION_FAILED");
    return buildDashboard(period);
  }),
  createMockRoute("GET", "/api/v1/analytics/creator/summary", ({ query }) => {
    const window = query.get("window") || "30d";
    const multiplier = window === "7d" ? 0.25 : window === "90d" ? 2.4 : 1;
    return {
      creatorId: "u_me",
      window,
      views: Math.round(48_200 * multiplier),
      engagements: Math.round(6_410 * multiplier),
      profileVisits: Math.round(3_190 * multiplier),
      revenueMinor: Math.round(142_000 * multiplier),
    };
  }),
  createMockRoute("GET", "/api/v1/creators/revenue-rules", () => ({
    giftCreatorSharePercentUpTo: 70, tipCreatorSharePercent: 90, subscriptionCreatorSharePercent: 70, subscriptionShareBasis: "net_of_store_fee", adsRevenueCreatorSharePercent: 40,
    adRevenuePolicy: { baseShareBasisPoints: 4000, rules: [{ contentType: "original", multiplierBasisPoints: 10000, effectiveShareBasisPoints: 4000 }, { contentType: "ai_generated", multiplierBasisPoints: 3000, effectiveShareBasisPoints: 1200 }], calculationNote: "The effective share applies to eligible, actually delivered and settled ad revenue. It is not a fixed payment per view or impression; final earnings depend on valid delivery, settlement and adjustments." },
    coinTransferPlatformFeePercent: 10, affiliateCommissionReleasedAfterEscrow: true, affiliateCommissionMaximumPercent: 30, coinCashValue: ngn(100), minimumPayout: ngn(500_000), withdrawalFeeDescription: "₦50 flat per withdrawal",
  })),
  createMockRoute("GET", "/api/v1/creators/earnings", () => ({ data: earnings, nextCursor: null })),
  createMockRoute("GET", "/api/v1/creators/eligibility", () => ({
    eligible: false, decision: "unavailable", decisionNote: "Trusted creator analytics and moderation data are not connected in this demo. Missing data cannot approve an application.", metricsAvailable: false, standingAvailable: false,
    requirements: [
      { key: "qualifying_impressions_30d", label: "Qualifying impressions from verified users in the last 30 days", currentValue: 0, requiredValue: 100000, remaining: 100000, met: false, available: false, source: "" },
      { key: "real_followers", label: "Real followers", currentValue: 0, requiredValue: 10000, remaining: 10000, met: false, available: false, source: "" },
      { key: "verified_followers", label: "Verified followers", currentValue: 0, requiredValue: 500, remaining: 500, met: false, available: false, source: "" },
      { key: "account_age", label: "Account at least 30 days old", currentValue: 0, requiredValue: 30, remaining: 30, met: false, available: false, source: "" },
      { key: "verified_email", label: "Verified email", currentValue: 0, requiredValue: 1, remaining: 1, met: false, available: false, source: "" },
      { key: "original_posts", label: "Original posts in the last 60 days", currentValue: 0, requiredValue: 10, remaining: 10, met: false, available: false, source: "" },
      { key: "policy_standing", label: "Days since last policy violation", currentValue: 0, requiredValue: 90, remaining: 90, met: false, available: false, source: "" },
    ],
  })),
  createMockRoute("GET", "/api/v1/creators/applications/me", () => null),
  createMockRoute("GET", "/api/v1/creators/brand-deals", () => ({ data: brandDeals, nextCursor: null })),
  createMockRoute("POST", "/api/v1/creators/brand-deals", ({ body }) => {
    const input = (body ?? {}) as Partial<{ brandName: string; amountMinor: number; currency: string; startsAt: string; endsAt: string | null; disclosure: string; notes: string }>;
    if (!input.brandName?.trim()) throw new ApiError(400, "brandName must be 1-120 characters", "VALIDATION_FAILED");
    if (!input.disclosure?.trim()) throw new ApiError(400, "disclosure must be 1-500 characters", "VALIDATION_FAILED");
    if (!input.startsAt || Number.isNaN(Date.parse(input.startsAt))) throw new ApiError(400, "startsAt must be an RFC 3339 date-time", "VALIDATION_FAILED");
    const deal: BrandDeal = { id: `deal_${Date.now()}`, brandName: input.brandName.trim(), amount: { amountMinor: input.amountMinor ?? 0, currency: input.currency ?? "NGN" }, startsAt: input.startsAt, endsAt: input.endsAt ?? null, disclosure: input.disclosure.trim(), notes: input.notes ?? "", createdAt: new Date().toISOString() };
    brandDeals = [deal, ...brandDeals];
    return deal;
  }),
  createMockRoute("DELETE", "/api/v1/creators/brand-deals/:dealId", ({ params }) => {
    if (!brandDeals.some((deal) => deal.id === params.dealId)) throw new ApiError(404, "That brand deal no longer exists.", "BRAND_DEAL_NOT_FOUND");
    brandDeals = brandDeals.filter((deal) => deal.id !== params.dealId);
    return undefined;
  }),
  createMockRoute("GET", "/api/v1/wallets/me/withdrawals", () => ({
    data: [{ id: "wd_1", amount: ngn(1_000_000), fee: ngn(5_000), netAmount: ngn(995_000), withdrawalStatus: "paid", reference: "ZW-48211", failureReason: null, createdAt: daysAgo(20), processedAt: daysAgo(19) }],
    nextCursor: null,
  })),
];
