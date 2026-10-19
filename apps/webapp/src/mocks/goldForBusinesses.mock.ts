import { ApiError } from "@/errors/api.error";
import type { GoldBillingInterval, GoldForBusinessesBusiness, GoldForBusinessesQuote, GoldForBusinessesState, GoldForBusinessesSubscription } from "@/types/goldForBusinesses.type";

import { signedInUserIsTheDemoSeller } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const unitMonthlyMinor = 300_000;
const yearlyExtraBps = 500;
const maximumProfiles = 5;
const tiers = [{ profiles: 1, discountBps: 500 }, { profiles: 2, discountBps: 1000 }, { profiles: 3, discountBps: 1200 }, { profiles: 4, discountBps: 1400 }, { profiles: 5, discountBps: 1600 }];

const seededBusinesses: GoldForBusinessesBusiness[] = [
  { profileId: "bp_ada_foods", displayName: "Ada Foods", profileType: "business", coverage: "none", hasOwnGold: false },
  { profileId: "bp_ada_consulting", displayName: "Ada Consulting", profileType: "business", coverage: "none", hasOwnGold: false },
  { profileId: "bp_ada_logistics", displayName: "Ada Logistics", profileType: "business", coverage: "none", hasOwnGold: false },
  { profileId: "br_adire", displayName: "Adire House", profileType: "brand", coverage: "none", hasOwnGold: true },
];

export const mockGoldForBusinessesSubscriptionId = "sub_gold_businesses_mock";

let mockGoldSubscription: GoldForBusinessesSubscription | null = null;

export const mockViewerHasBluePremium = () => signedInUserIsTheDemoSeller();

function readSelection(body: unknown): { profileIds: string[]; interval: GoldBillingInterval } {
  const input = (body ?? {}) as { profileIds?: unknown; interval?: unknown };
  const profileIds = Array.isArray(input.profileIds) ? input.profileIds.filter((id): id is string => typeof id === "string") : [];
  if (input.interval !== "month" && input.interval !== "year") throw new ApiError(422, "Choose monthly or yearly billing.", "VALIDATION_FAILED");
  if (profileIds.length > maximumProfiles) throw new ApiError(422, "You can cover up to 5 businesses.", "COMBINED_GOLD_TOO_MANY_PROFILES");
  if (profileIds.length === 0 || profileIds.some((id) => !seededBusinesses.some((business) => business.profileId === id && !business.hasOwnGold))) throw new ApiError(422, "Pick businesses you own that don't have Gold yet.", "COMBINED_GOLD_PROFILES_INVALID");
  return { profileIds, interval: input.interval };
}

function buildMockGoldQuote(profileIds: string[], interval: GoldBillingInterval): GoldForBusinessesQuote {
  const months = interval === "year" ? 12 : 1;
  const tierBps = tiers.find((tier) => tier.profiles === profileIds.length)?.discountBps ?? 0;
  const grossMinor = unitMonthlyMinor * profileIds.length * months;
  const tierDiscountMinor = Math.round((grossMinor * tierBps) / 10_000);
  const yearlyExtraDiscountMinor = interval === "year" ? Math.round(((grossMinor - tierDiscountMinor) * yearlyExtraBps) / 10_000) : 0;
  const totalMinor = grossMinor - tierDiscountMinor - yearlyExtraDiscountMinor;
  const perProfileMinor = profileIds.map(() => Math.round(totalMinor / profileIds.length));
  const lineItems = [
    { kind: "checkmark", label: "Gold checkmark for your businesses", amountMinor: grossMinor },
    { kind: "multi_business_discount", label: "Multi-business discount", amountMinor: -tierDiscountMinor },
    ...(yearlyExtraDiscountMinor > 0 ? [{ kind: "yearly_extra_discount", label: "Extra yearly discount", amountMinor: -yearlyExtraDiscountMinor }] : []),
  ];
  return {
    interval, currency: "NGN", region: "NG",
    unitMonthlyPrice: { amountMinor: unitMonthlyMinor, currency: "NGN" },
    listTotal: { amountMinor: grossMinor, currency: "NGN" },
    total: { amountMinor: totalMinor, currency: "NGN" },
    breakdown: { unitMonthlyMinor, profileCount: profileIds.length, months, interval, grossMinor, tierBps, tierDiscountMinor, yearlyExtraBps: interval === "year" ? yearlyExtraBps : 0, yearlyExtraDiscountMinor, standardYearlyBps: 0, standardYearlyDiscountMinor: 0, totalMinor, perProfileMinor },
    discount: { listAmountMinor: grossMinor, amountMinor: totalMinor, discountKind: "multi_business", discountBps: Math.round(((grossMinor - totalMinor) * 10_000) / grossMinor) },
    profiles: profileIds.map((profileId, index) => {
      const business = seededBusinesses.find((entry) => entry.profileId === profileId)!;
      return { profileId, displayName: business.displayName, profileType: business.profileType, price: { amountMinor: perProfileMinor[index] ?? 0, currency: "NGN" } };
    }),
    lineItems,
    canBuyOnWeb: true,
  };
}

function requirePremium() {
  if (!mockViewerHasBluePremium()) throw new ApiError(403, "Gold for all your businesses needs Blue Premium.", "PREMIUM_REQUIRED");
}

const withCoverage = (profileIds: readonly string[], coverage: GoldForBusinessesBusiness["coverage"]) =>
  seededBusinesses.filter((business) => profileIds.includes(business.profileId)).map((business) => ({ ...business, coverage }));

export const goldForBusinessesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/subscriptions/gold-for-businesses", (): GoldForBusinessesState => {
    const covered = mockGoldSubscription?.coveredProfiles ?? [];
    return {
      premium: mockViewerHasBluePremium(),
      rules: { maximumProfiles, yearlyExtraBps, yearlyMode: "replace", tiers },
      businesses: signedInUserIsTheDemoSeller() ? seededBusinesses.map((business) => covered.find((entry) => entry.profileId === business.profileId) ?? business) : [],
      subscription: mockGoldSubscription,
    };
  }),
  createMockRoute("POST", "/api/v1/subscriptions/gold-for-businesses/quote", ({ body }) => {
    requirePremium();
    const { profileIds, interval } = readSelection(body);
    return buildMockGoldQuote(profileIds, interval);
  }),
  createMockRoute("POST", "/api/v1/subscriptions/gold-for-businesses/checkout", ({ body }) => {
    requirePremium();
    const { profileIds, interval } = readSelection(body);
    if (mockGoldSubscription) throw new ApiError(409, "You already have Gold for all your businesses.", "ALREADY_SUBSCRIBED");
    const quote = buildMockGoldQuote(profileIds, interval);
    if ((body as { expectedTotalMinor?: unknown }).expectedTotalMinor !== quote.total.amountMinor) throw new ApiError(409, "The price changed. Check the new total.", "PRICE_CHANGED");
    const subscriptionId = mockGoldForBusinessesSubscriptionId;
    mockGoldSubscription = { id: subscriptionId, status: "active", interval, price: quote.total, discountKind: "multi_business", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(), cancelAtPeriodEnd: false, coveredProfiles: withCoverage(profileIds, "pending") };
    return { subscriptionId, authorizationUrl: "/verification?step=paid", reference: `ref_${subscriptionId}`, provider: "flutterwave", price: quote.total, discount: quote.discount, trial: false, lineItems: quote.lineItems };
  }),
  createMockRoute("PUT", "/api/v1/subscriptions/gold-for-businesses/:subscriptionId/profiles", ({ params, body }) => {
    if (!mockGoldSubscription || mockGoldSubscription.id !== params.subscriptionId) throw new ApiError(404, "Subscription not found.", "NOT_FOUND");
    const profileIds = ((body ?? {}) as { profileIds?: string[] }).profileIds ?? [];
    const current = mockGoldSubscription.coveredProfiles.map((profile) => profile.profileId);
    const added = profileIds.filter((id) => !current.includes(id));
    if (added.length > 0) requirePremium();
    readSelection({ profileIds, interval: mockGoldSubscription.interval });
    const removing = current.filter((id) => !profileIds.includes(id));
    const amountDueMinor = added.length * Math.round(unitMonthlyMinor / 2);
    mockGoldSubscription = { ...mockGoldSubscription, coveredProfiles: [...withCoverage(profileIds, "active"), ...withCoverage(removing, "removing")] };
    return {
      added, removing, removalsEffectiveAt: mockGoldSubscription.currentPeriodEnd ?? new Date().toISOString(),
      charge: { lineItems: added.length ? [{ kind: "proration", label: "Added businesses for the rest of this period", amountMinor: amountDueMinor }] : [], subtotalMinor: amountDueMinor, amountDueMinor, creditAppliedMinor: 0, remainingCreditMinor: 0, checkmarkIncluded: true },
      chargeStatus: added.length ? "succeeded" : undefined,
    };
  }),
];
