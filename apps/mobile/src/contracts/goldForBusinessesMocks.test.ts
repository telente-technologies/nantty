import { ApiError } from "@/errors/api.error";
import { resolveMockApiRequest } from "@/mocks";
import { setMockBluePremiumState } from "@/mocks/bluePremiumMembership.mock";
import { seedMockGoldForBusinessesSubscription } from "@/mocks/goldForBusinesses.mock";
import type { GoldForBusinessesOverview, GoldForBusinessesQuote } from "@/types/goldForBusinesses.type";

import { validateAgainstContract } from "./contractSchema.util";
import { goldForBusinessesContracts } from "./subscriptions.contract";

const failureOf = (request: Promise<unknown>) => request.then(() => null, (error: unknown) => error);

describe("Gold for all your businesses mocks", () => {
  beforeEach(() => {
    setMockBluePremiumState("premium");
    seedMockGoldForBusinessesSubscription(["s_home"]);
  });
  afterEach(() => {
    setMockBluePremiumState(null);
    seedMockGoldForBusinessesSubscription(null);
  });

  it.each(goldForBusinessesContracts.map((contract) => [`${contract.method} ${contract.path} ${JSON.stringify(contract.body ?? {})}`, contract] as const))("%s matches the contract", async (_name, contract) => {
    const payload = await resolveMockApiRequest<unknown>(contract.method, contract.path, contract.body);
    expect(validateAgainstContract(contract.schema, payload)).toEqual([]);
  });

  it("matches the contract with no plan yet", async () => {
    seedMockGoldForBusinessesSubscription(null);
    const overview = await resolveMockApiRequest<GoldForBusinessesOverview>("GET", "/api/v1/subscriptions/gold-for-businesses");
    expect(validateAgainstContract(goldForBusinessesContracts[0]!.schema, overview)).toEqual([]);
    expect(overview.subscription).toBeNull();
    expect(overview.rules.tiers.map((tier) => tier.discountBps)).toEqual([500, 1000, 1200, 1400, 1600]);
  });

  it("prices a yearly plan with the tier discount and the extra 5% instead of the normal 20%", async () => {
    const quote = await resolveMockApiRequest<GoldForBusinessesQuote>("POST", "/api/v1/subscriptions/gold-for-businesses/quote", { profileIds: ["s_home"], interval: "year" });
    const { breakdown } = quote;
    expect(breakdown.tierBps).toBe(500);
    expect(breakdown.yearlyExtraBps).toBe(500);
    expect(breakdown.standardYearlyDiscountMinor).toBe(0);
    expect(breakdown.grossMinor - breakdown.tierDiscountMinor - breakdown.yearlyExtraDiscountMinor).toBe(quote.total.amountMinor);
    expect(quote.lineItems.map((line) => line.kind)).toEqual(["checkmark", "multi_business_discount", "yearly_extra_discount"]);
  });

  it("refuses a quote without Premium, with too many businesses or with someone else's profile", async () => {
    expect(await failureOf(resolveMockApiRequest("POST", "/api/v1/subscriptions/gold-for-businesses/quote", { profileIds: ["a", "b", "c", "d", "e", "f"], interval: "month" }))).toMatchObject({ status: 422, code: "COMBINED_GOLD_TOO_MANY_PROFILES" });
    expect(await failureOf(resolveMockApiRequest("POST", "/api/v1/subscriptions/gold-for-businesses/quote", { profileIds: ["s_other"], interval: "month" }))).toMatchObject({ status: 422, code: "COMBINED_GOLD_PROFILES_INVALID" });
    setMockBluePremiumState("standard");
    const failure = await failureOf(resolveMockApiRequest("POST", "/api/v1/subscriptions/gold-for-businesses/quote", { profileIds: ["s_home"], interval: "month" }));
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 403, code: "PREMIUM_REQUIRED" });
    const overview = await resolveMockApiRequest<GoldForBusinessesOverview>("GET", "/api/v1/subscriptions/gold-for-businesses");
    expect(overview.premium).toBe(false);
  });

  it("lists the covered businesses on an existing plan", async () => {
    const overview = await resolveMockApiRequest<GoldForBusinessesOverview>("GET", "/api/v1/subscriptions/gold-for-businesses");
    expect(overview.subscription?.coveredProfiles.map((profile) => profile.coverage)).toEqual(["active"]);
  });
});
