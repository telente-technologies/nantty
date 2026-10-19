import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const money = c.object({ amountMinor: c.number(), currency: c.string() });
const coverage = c.string(["none", "pending", "active", "removing"]);
const eligibleBusiness = c.object({ profileId: c.string(), displayName: c.string(), profileType: c.string(["business", "brand"]), coverage, hasOwnGold: c.boolean() });
const discountKind = c.string(["multi_business", "offer", "yearly", "none"]);
const interval = c.string(["month", "year"]);
const lineItem = c.object({ kind: c.string(), label: c.string(), amountMinor: c.number() });

const goldForBusinessesOverview = c.object({
  premium: c.boolean(),
  rules: c.object({ maximumProfiles: c.number(), yearlyExtraBps: c.number(), yearlyMode: c.string(), tiers: c.array(c.object({ profiles: c.number(), discountBps: c.number() })) }),
  businesses: c.array(eligibleBusiness),
  subscription: c.nullable(c.object({
    id: c.string(), status: c.string(), interval, price: money, discountKind, currentPeriodEnd: c.nullable(c.string()), cancelAtPeriodEnd: c.boolean(), coveredProfiles: c.array(eligibleBusiness),
  })),
});

const goldForBusinessesQuote = c.object({
  interval, currency: c.string(), region: c.string(), unitMonthlyPrice: money, listTotal: money, total: money,
  breakdown: c.object({
    unitMonthlyMinor: c.number(), profileCount: c.number(), months: c.number(), interval, grossMinor: c.number(), tierBps: c.number(), tierDiscountMinor: c.number(),
    yearlyExtraBps: c.number(), yearlyExtraDiscountMinor: c.number(), standardYearlyBps: c.number(), standardYearlyDiscountMinor: c.number(), totalMinor: c.number(), perProfileMinor: c.array(c.number()),
  }),
  discount: c.object({ listAmountMinor: c.number(), amountMinor: c.number(), discountKind, discountBps: c.number(), offerDiscountMinor: c.number() }, ["offerDiscountMinor"]),
  profiles: c.array(c.object({ profileId: c.string(), displayName: c.string(), profileType: c.string(["business", "brand"]), price: money })),
  lineItems: c.array(lineItem),
  canBuyOnWeb: c.boolean(),
  billingNote: c.string(),
}, ["billingNote"]);

const goldCoverageChange = c.object({
  added: c.array(c.string()), removing: c.array(c.string()), removalsEffectiveAt: c.string(),
  charge: c.object({ lineItems: c.array(lineItem), subtotalMinor: c.number(), amountDueMinor: c.number(), creditAppliedMinor: c.number(), remainingCreditMinor: c.number(), checkmarkIncluded: c.boolean() }),
  chargeStatus: c.string(["succeeded", "pending", "requires_action", "failed"]),
  actionUrl: c.string(),
}, ["chargeStatus", "actionUrl"]);

export const MOCK_GOLD_FOR_BUSINESSES_SUBSCRIPTION_ID = "cgs_mock_1";

export const goldForBusinessesContracts: readonly EndpointContract[] = [
  { domain: "subscriptions", method: "GET", path: "/api/v1/subscriptions/gold-for-businesses", schema: goldForBusinessesOverview },
  { domain: "subscriptions", method: "POST", path: "/api/v1/subscriptions/gold-for-businesses/quote", body: { profileIds: ["s_home"], interval: "year" }, schema: goldForBusinessesQuote },
  { domain: "subscriptions", method: "POST", path: "/api/v1/subscriptions/gold-for-businesses/quote", body: { profileIds: ["s_home"], interval: "month" }, schema: goldForBusinessesQuote },
  { domain: "subscriptions", method: "PUT", path: `/api/v1/subscriptions/gold-for-businesses/${MOCK_GOLD_FOR_BUSINESSES_SUBSCRIPTION_ID}/profiles`, body: { profileIds: ["s_home"] }, schema: goldCoverageChange },
];
