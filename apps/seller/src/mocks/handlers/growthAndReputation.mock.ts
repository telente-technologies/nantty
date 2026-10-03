import { registerAdsSummaryMockRoutes } from "@/mocks/handlers/adsSummary.mock";
import { registerFlashSaleAndBundleMockRoutes } from "@/mocks/handlers/marketingFlashSalesAndBundles.mock";
import { registerMarketingOverviewMockRoutes } from "@/mocks/handlers/marketingOverview.mock";
import { registerReviewMockRoutes } from "@/mocks/handlers/reviews.mock";

export function registerGrowthAndReputationMockHandlers(): void {
  registerMarketingOverviewMockRoutes();
  registerFlashSaleAndBundleMockRoutes();
  registerAdsSummaryMockRoutes();
  registerReviewMockRoutes();
}
