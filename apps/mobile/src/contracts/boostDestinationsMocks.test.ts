import { resolveMockApiRequest } from "@/mocks";
import { getSignedInMockUser } from "@/mocks/fixtures.mock";
import type { BoostOptions, CreatedBoost, CreateBoostRequest } from "@/types/boost.type";

const promoteRequest = async (overrides: Partial<CreateBoostRequest>): Promise<CreateBoostRequest> => {
  const options = await resolveMockApiRequest<BoostOptions>("GET", "/api/v1/ads/boosts/options", undefined);
  return { goal: "profile_visits", audience: { mode: "automatic" }, dailyBudget: options.suggestedDailyBudgets[0]!, durationDays: options.durationDayOptions[0]!, paymentMethod: "card", ...overrides };
};

describe("boost destination mocks", () => {
  it("promotes your own profile and reports profile visits for it", async () => {
    const me = getSignedInMockUser();
    const created = await resolveMockApiRequest<CreatedBoost>("POST", "/api/v1/ads/boosts", await promoteRequest({ destinationType: "profile", targetId: me.id }), "promote-profile-1");
    expect(created.boost).toMatchObject({ destinationType: "profile", targetId: me.id, postId: "", goal: "profile_visits" });
    expect(created.checkoutUrl).toMatch(/^https:\/\//);
  });

  it("refuses to promote someone else's profile or store", async () => {
    await expect(resolveMockApiRequest("POST", "/api/v1/ads/boosts", await promoteRequest({ destinationType: "profile", targetId: "someone-else" }), "promote-foreign-1")).rejects.toMatchObject({ code: "DESTINATION_NOT_OWNED" });
    await expect(resolveMockApiRequest("POST", "/api/v1/ads/boosts", await promoteRequest({ destinationType: "store", goal: "store_visits", targetId: "not-my-store" }), "promote-foreign-2")).rejects.toMatchObject({ code: "DESTINATION_NOT_OWNED" });
  });

  it("estimates store visits for a store goal", async () => {
    const request = await promoteRequest({ destinationType: "store", targetId: "store-1", goal: "store_visits" });
    const { paymentMethod: _paymentMethod, ...estimateRequest } = request;
    const estimate = await resolveMockApiRequest<{ estimatedResultsLabel: string }>("POST", "/api/v1/ads/boosts/estimate", estimateRequest);
    expect(estimate.estimatedResultsLabel).toMatch(/store visits$/);
  });
});
