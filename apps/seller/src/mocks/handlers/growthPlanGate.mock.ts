import { convertAccessToSellerPlan, isFeatureIncludedInPlan, minimumPlanByFeature, type PlanFeature } from "@/config/planFeatures.config";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { MockResponse } from "@/mocks/mockRouter.mock";

export function readMockStorePlanFeatureDenial(storeId: string, feature: PlanFeature): MockResponse | null {
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  const plan = convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null });
  if (isFeatureIncludedInPlan(feature, plan)) return null;
  const requiredPlan = minimumPlanByFeature[feature];
  return { status: 402, body: { message: `This needs the ${requiredPlan === "business" ? "Business" : "Pro"} plan.`, code: "PLAN_FEATURE_REQUIRED", requiredPlan } };
}
