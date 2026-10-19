import { MockHttpError, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { GoldForBusinessesOverview, GoldForBusinessesProfile } from "@/types/goldForBusinesses.type";

const dayMs = 86_400_000;
const combinedPlanOwnerUserIds = new Set(["usr_adaeze"]);
const rules: GoldForBusinessesOverview["rules"] = {
  maximumProfiles: 5,
  yearlyExtraBps: 500,
  yearlyMode: "replace",
  tiers: [{ profiles: 1, discountBps: 500 }, { profiles: 2, discountBps: 1000 }, { profiles: 3, discountBps: 1200 }, { profiles: 4, discountBps: 1400 }, { profiles: 5, discountBps: 1600 }],
};

function buildCoveredProfiles(): GoldForBusinessesProfile[] {
  return [
    { profileId: "store_ife_lifestyle", displayName: "Ife Lifestyle", profileType: "business", coverage: "active", hasOwnGold: false },
    { profileId: "store_adire_lab_studio", displayName: "Adire Lab Studio", profileType: "business", coverage: "removing", hasOwnGold: false },
    { profileId: "brand_ife_lifestyle_home", displayName: "Ife Home", profileType: "brand", coverage: "pending", hasOwnGold: false },
  ];
}

export function buildGoldForBusinessesOverview(userId: string): GoldForBusinessesOverview {
  if (!combinedPlanOwnerUserIds.has(userId)) return { premium: false, rules, businesses: [], subscription: null };
  const coveredProfiles = buildCoveredProfiles();
  return {
    premium: true,
    rules,
    businesses: coveredProfiles,
    subscription: {
      id: "sub_gold_combined_adaeze",
      status: "active",
      interval: "month",
      price: { amountMinor: 792_000, currency: "NGN" },
      discountKind: "multi_business",
      currentPeriodEnd: new Date(Date.now() + 18 * dayMs).toISOString(),
      cancelAtPeriodEnd: false,
      coveredProfiles,
    },
  };
}

export function registerGoldForBusinessesMockHandlers(): void {
  registerMockRoute("GET", "/subscriptions/gold-for-businesses", (request) => {
    if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    return respondWithJson(200, buildGoldForBusinessesOverview(request.principal.userId));
  });
}
