import { convertAccessToSellerPlan, isFeatureIncludedInPlan, minimumPlanByFeature, planLimitsByPlan, sellerPlanLabels, type PlanFeature, type SellerPlan } from "@/config/planFeatures.config";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";

export class MockPlanFeatureError extends MockHttpError {
  public constructor(public readonly requiredPlan: SellerPlan, message: string) {
    super(402, "PLAN_FEATURE_REQUIRED", message);
  }
}

export function readMockSellerPlanForStore(storeId: string): SellerPlan {
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  return convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null });
}

export function assertMockStorePlanIncludesFeature(storeId: string, feature: PlanFeature, featureDescription: string): void {
  if (isFeatureIncludedInPlan(feature, readMockSellerPlanForStore(storeId))) return;
  const requiredPlan = minimumPlanByFeature[feature];
  throw new MockPlanFeatureError(requiredPlan, `${featureDescription} is part of ${sellerPlanLabels[requiredPlan]}. Upgrade to use it.`);
}

export function readMaximumActiveProductsForStore(storeId: string): number | null {
  return planLimitsByPlan[readMockSellerPlanForStore(storeId)].maxActiveProducts;
}

export function assertActiveProductSlotAvailable(storeId: string, excludedProductId: string | null): void {
  const maximumActiveProducts = readMaximumActiveProductsForStore(storeId);
  if (maximumActiveProducts === null) return;
  const activeCount = readMockDatabase().products.filter((product) => product.status === "active" && product.id !== excludedProductId).length;
  if (activeCount >= maximumActiveProducts) {
    throw new MockHttpError(409, "PRODUCT_LIMIT_REACHED", `Your plan allows ${maximumActiveProducts.toLocaleString("en-NG")} active products and all are in use. Save this one as a draft, archive another product, or upgrade.`);
  }
}
