import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError, requireMockStorePrincipal } from "@/mocks/mockResponses.mock";
import type { MockRequest } from "@/mocks/mockRouter.mock";
import { readMockStorePlanFeatureDenial } from "@/mocks/handlers/growthPlanGate.mock";
import { buildDemoMarketingState, convertProductToMarketingOption, type DemoMarketingState } from "@/mocks/seed/demoMarketing.mock";
import type { PlanFeature } from "@/config/planFeatures.config";
import type { MarketingCampaignStatus, MarketingProductOption } from "@/types/marketing.type";

export function readMarketingState(): DemoMarketingState {
  return readStoreScopedMockSlice("marketing", () => {
    const database = readMockDatabase();
    return buildDemoMarketingState(database.products, database.settings.currency);
  });
}

export function requireMarketingPlanFeature(request: MockRequest, feature: PlanFeature = "advanced_promotions"): void {
  const principal = requireMockStorePrincipal(request);
  const denial = readMockStorePlanFeatureDenial(principal.storeId, feature);
  if (denial) throw new MockHttpError(402, "PLAN_FEATURE_REQUIRED", String((denial.body as { message: string }).message));
}

export function isMarketingFeatureAvailableForRequest(request: MockRequest, feature: PlanFeature = "advanced_promotions"): boolean {
  const principal = requireMockStorePrincipal(request);
  return readMockStorePlanFeatureDenial(principal.storeId, feature) === null;
}

export function findMarketingProductOptionOrThrow(productId: string, path: string): MarketingProductOption {
  const product = readMockDatabase().products.find((candidate) => candidate.id === productId && candidate.status !== "archived");
  if (!product) throw new MockHttpError(400, "VALIDATION_FAILED", `${path}: choose one of your products.`);
  return convertProductToMarketingOption(product);
}

export function deriveTimeBoxedCampaignStatus(startsAt: string, endsAt: string, currentStatus: MarketingCampaignStatus, now = Date.now()): MarketingCampaignStatus {
  if (currentStatus === "paused" || currentStatus === "draft") return currentStatus;
  if (new Date(startsAt).getTime() > now) return "scheduled";
  if (new Date(endsAt).getTime() <= now) return "ended";
  return "active";
}

export function listMarketingProductOptions(searchText: string | null): MarketingProductOption[] {
  const needle = (searchText ?? "").trim().toLowerCase();
  return readMockDatabase()
    .products.filter((product) => product.status === "active" && (!needle || product.name.toLowerCase().includes(needle)))
    .slice(0, 20)
    .map(convertProductToMarketingOption);
}
