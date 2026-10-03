import { registerOverviewAndAnalyticsMockHandlers } from "@/mocks/handlers/overviewAndAnalytics.mock";
import { registerDeliveryAndMessagesMockHandlers } from "@/mocks/handlers/deliveryAndMessages.mock";
import { registerGrowthAndReputationMockHandlers } from "@/mocks/handlers/growthAndReputation.mock";
import { registerFinanceAndReportsMockHandlers } from "@/mocks/handlers/financeAndReports.mock";
import { registerStorefrontAndWorkspaceMockHandlers } from "@/mocks/handlers/storefrontAndWorkspace.mock";
import { registerCatalogOperationsMockHandlers } from "@/mocks/handlers/catalogOperations.mock";
import { registerAccessAndAuthMockHandlers } from "@/mocks/handlers/accessAndAuth.mock";
import { registerBillingOfferMockHandlers } from "@/mocks/handlers/billingOffer.mock";
import { registerBusinessDocumentMockHandlers } from "@/mocks/handlers/businessDocuments.mock";
import { registerPayoutOnboardingMockHandlers } from "@/mocks/handlers/payoutOnboarding.mock";
import { registerAffiliatesMockHandlers } from "@/mocks/handlers/affiliates.mock";
import { registerBrandsMockHandlers } from "@/mocks/handlers/brands.mock";
import { registerConsentsMockHandlers } from "@/mocks/handlers/consentsHandlers.mock";
import { registerCatalogMockHandlers } from "@/mocks/handlers/catalog.mock";
import { registerCommerceMockHandlers } from "@/mocks/handlers/commerce.mock";
import { registerInsightsMockHandlers } from "@/mocks/handlers/insights.mock";
import { registerTeamAndSettingsMockHandlers } from "@/mocks/handlers/teamAndSettings.mock";

export function registerEveryMockHandler(): void {
  registerAccessAndAuthMockHandlers();
  registerBillingOfferMockHandlers();
  registerBusinessDocumentMockHandlers();
  registerPayoutOnboardingMockHandlers();
  registerConsentsMockHandlers();
  registerTeamAndSettingsMockHandlers();
  registerCatalogMockHandlers();
  registerCommerceMockHandlers();
  registerInsightsMockHandlers();
  registerAffiliatesMockHandlers();
  registerBrandsMockHandlers();
  registerOverviewAndAnalyticsMockHandlers();
  registerDeliveryAndMessagesMockHandlers();
  registerGrowthAndReputationMockHandlers();
  registerFinanceAndReportsMockHandlers();
  registerStorefrontAndWorkspaceMockHandlers();
  registerCatalogOperationsMockHandlers();
}
