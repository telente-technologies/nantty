import { ApiError } from "@/errors/api.error";
import type {
  GoldCoverage, GoldCoverageChange, GoldEligibleBusiness, GoldForBusinessesInterval, GoldForBusinessesOverview, GoldForBusinessesQuote, GoldForBusinessesRules,
} from "@/types/goldForBusinesses.type";

import { mockBluePremiumState } from "./bluePremiumMembership.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { buildMockLinkedProfiles } from "./linkedProfiles.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const GOLD_MONTHLY_USD_CENTS_PER_PROFILE = 200;
const BASIS_POINTS = 10_000;
const PRORATED_SHARE_OF_PERIOD = 0.5;

const RULES: GoldForBusinessesRules = {
  maximumProfiles: 5,
  yearlyExtraBps: 500,
  yearlyMode: "replace",
  tiers: [{ profiles: 1, discountBps: 500 }, { profiles: 2, discountBps: 1000 }, { profiles: 3, discountBps: 1200 }, { profiles: 4, discountBps: 1400 }, { profiles: 5, discountBps: 1600 }],
};

interface MockCombinedGold {
  readonly id: string;
  readonly interval: GoldForBusinessesInterval;
  readonly covered: readonly string[];
  readonly removing: readonly string[];
}

const subscriptionByUserId = new Map<string, MockCombinedGold>();

function eligibleBusinesses(): GoldEligibleBusiness[] {
  const subscription = subscriptionByUserId.get(getSignedInMockUser().id);
  const coverageOf = (profileId: string): GoldCoverage =>
    subscription?.removing.includes(profileId) ? "removing" : subscription?.covered.includes(profileId) ? "active" : "none";
  return buildMockLinkedProfiles().items
    .filter((item) => item.status !== "retired")
    .map((item) => ({ profileId: item.profileId, displayName: item.name, profileType: item.kind === "brand" ? "brand" : "business", coverage: coverageOf(item.profileId), hasOwnGold: false }));
}

function readInterval(value: unknown): GoldForBusinessesInterval {
  if (value === "month" || value === "year") return value;
  throw new ApiError(422, "Choose monthly or yearly billing.", "VALIDATION_FAILED");
}

function readProfileIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) throw new ApiError(422, "Choose the businesses to cover.", "VALIDATION_FAILED");
  const profileIds = [...new Set(value as string[])];
  if (profileIds.length > RULES.maximumProfiles) throw new ApiError(422, "You can cover up to 5 businesses.", "COMBINED_GOLD_TOO_MANY_PROFILES");
  const businesses = eligibleBusinesses();
  const valid = profileIds.length > 0 && profileIds.every((id) => businesses.some((business) => business.profileId === id && !business.hasOwnGold));
  if (!valid) throw new ApiError(422, "Choose from your own businesses that don't already have Gold.", "COMBINED_GOLD_PROFILES_INVALID");
  return profileIds;
}

function tierBpsFor(profileCount: number): number {
  return RULES.tiers.find((tier) => tier.profiles === profileCount)?.discountBps ?? 0;
}

export function buildMockGoldQuote(profileIds: readonly string[], interval: GoldForBusinessesInterval): GoldForBusinessesQuote {
  const unit = convertUsdCentsToViewerCurrency(GOLD_MONTHLY_USD_CENTS_PER_PROFILE);
  const months = interval === "year" ? 12 : 1;
  const grossMinor = unit.amountMinor * profileIds.length * months;
  const tierBps = tierBpsFor(profileIds.length);
  const tierDiscountMinor = Math.round((grossMinor * tierBps) / BASIS_POINTS);
  const yearlyExtraBps = interval === "year" ? RULES.yearlyExtraBps : 0;
  const yearlyExtraDiscountMinor = Math.round(((grossMinor - tierDiscountMinor) * yearlyExtraBps) / BASIS_POINTS);
  const totalMinor = grossMinor - tierDiscountMinor - yearlyExtraDiscountMinor;
  const share = Math.floor(totalMinor / profileIds.length);
  const perProfileMinor = profileIds.map((_, index) => (index === 0 ? totalMinor - share * (profileIds.length - 1) : share));
  const businesses = eligibleBusinesses();
  const lineItems = [
    { kind: "checkmark", label: "Gold checkmark for your businesses", amountMinor: grossMinor },
    { kind: "multi_business_discount", label: "Multi-business discount", amountMinor: -tierDiscountMinor },
    ...(yearlyExtraDiscountMinor > 0 ? [{ kind: "yearly_extra_discount", label: "Extra yearly discount", amountMinor: -yearlyExtraDiscountMinor }] : []),
  ];
  return {
    interval, currency: unit.currency, region: "NG", unitMonthlyPrice: unit,
    listTotal: { amountMinor: grossMinor, currency: unit.currency },
    total: { amountMinor: totalMinor, currency: unit.currency },
    breakdown: {
      unitMonthlyMinor: unit.amountMinor, profileCount: profileIds.length, months, interval, grossMinor, tierBps, tierDiscountMinor, yearlyExtraBps, yearlyExtraDiscountMinor,
      standardYearlyBps: 0, standardYearlyDiscountMinor: 0, totalMinor, perProfileMinor,
    },
    discount: { listAmountMinor: grossMinor, amountMinor: totalMinor, discountKind: "multi_business", discountBps: Math.round(((grossMinor - totalMinor) * BASIS_POINTS) / Math.max(grossMinor, 1)) },
    profiles: profileIds.map((profileId, index) => {
      const business = businesses.find((entry) => entry.profileId === profileId)!;
      return { profileId, displayName: business.displayName, profileType: business.profileType, price: { amountMinor: perProfileMinor[index]!, currency: unit.currency } };
    }),
    lineItems,
    canBuyOnWeb: true,
  };
}

function buildOverview(): GoldForBusinessesOverview {
  const businesses = eligibleBusinesses();
  const subscription = subscriptionByUserId.get(getSignedInMockUser().id);
  if (!subscription) return { premium: mockBluePremiumState() === "premium", rules: RULES, businesses, subscription: null };
  const quote = buildMockGoldQuote(subscription.covered, subscription.interval);
  return {
    premium: mockBluePremiumState() === "premium",
    rules: RULES,
    businesses,
    subscription: {
      id: subscription.id, status: "active", interval: subscription.interval, price: quote.total, discountKind: "multi_business",
      currentPeriodEnd: new Date(Date.now() + 18 * 86_400_000).toISOString(), cancelAtPeriodEnd: false,
      coveredProfiles: businesses.filter((business) => business.coverage !== "none"),
    },
  };
}

export function seedMockGoldForBusinessesSubscription(profileIds: readonly string[] | null, interval: GoldForBusinessesInterval = "month"): void {
  const userId = getSignedInMockUser().id;
  if (profileIds) subscriptionByUserId.set(userId, { id: "cgs_mock_1", interval, covered: profileIds, removing: [] });
  else subscriptionByUserId.delete(userId);
}

function changeCoveredBusinesses(subscriptionId: string, body: unknown): GoldCoverageChange {
  const userId = getSignedInMockUser().id;
  const subscription = subscriptionByUserId.get(userId);
  if (!subscription || subscription.id !== subscriptionId) throw new ApiError(404, "We couldn't find that plan.", "NOT_FOUND");
  const desired = readProfileIds((body as { profileIds?: unknown }).profileIds);
  const added = desired.filter((id) => !subscription.covered.includes(id));
  const removing = subscription.covered.filter((id) => !desired.includes(id));
  if (added.length > 0 && mockBluePremiumState() !== "premium") throw new ApiError(403, "Adding businesses needs Blue Premium.", "PREMIUM_REQUIRED");
  const quote = buildMockGoldQuote(desired, subscription.interval);
  const amountDueMinor = Math.round(quote.breakdown.perProfileMinor[0]! * added.length * PRORATED_SHARE_OF_PERIOD);
  const expected = (body as { expectedChargeMinor?: unknown }).expectedChargeMinor;
  if (typeof expected === "number" && expected !== amountDueMinor) throw new ApiError(409, "The price changed. Check the new amount.", "PRICE_CHANGED");
  subscriptionByUserId.set(userId, { ...subscription, covered: [...subscription.covered, ...added], removing });
  const removalsEffectiveAt = new Date(Date.now() + 18 * 86_400_000).toISOString();
  return {
    added, removing, removalsEffectiveAt,
    charge: {
      lineItems: added.length > 0 ? [{ kind: "checkmark", label: "Gold checkmark for added businesses (prorated)", amountMinor: amountDueMinor }] : [],
      subtotalMinor: amountDueMinor, amountDueMinor, creditAppliedMinor: 0, remainingCreditMinor: 0, checkmarkIncluded: added.length > 0,
    },
    ...(added.length > 0 ? { chargeStatus: "succeeded" as const } : {}),
  };
}

export const goldForBusinessesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/subscriptions/gold-for-businesses", () => buildOverview()),
  createMockRoute("POST", "/api/v1/subscriptions/gold-for-businesses/quote", ({ body }) => {
    if (mockBluePremiumState() !== "premium") throw new ApiError(403, "Gold for all your businesses needs Blue Premium.", "PREMIUM_REQUIRED");
    const input = (body ?? {}) as { profileIds?: unknown; interval?: unknown };
    const interval = readInterval(input.interval);
    return buildMockGoldQuote(readProfileIds(input.profileIds), interval);
  }),
  createMockRoute("PUT", "/api/v1/subscriptions/gold-for-businesses/:subscriptionId/profiles", ({ params, body }) => changeCoveredBusinesses(params.subscriptionId!, body)),
];
