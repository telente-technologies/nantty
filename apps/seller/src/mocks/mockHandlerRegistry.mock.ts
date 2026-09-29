import { registerAccessAndAuthMockHandlers } from "@/mocks/handlers/accessAndAuth.mock";
import { registerAffiliatesMockHandlers } from "@/mocks/handlers/affiliates.mock";
import { registerCatalogMockHandlers } from "@/mocks/handlers/catalog.mock";
import { registerCommerceMockHandlers } from "@/mocks/handlers/commerce.mock";
import { registerInsightsMockHandlers } from "@/mocks/handlers/insights.mock";
import { registerPosMockHandlers } from "@/mocks/handlers/pos.mock";
import { registerTeamAndSettingsMockHandlers } from "@/mocks/handlers/teamAndSettings.mock";

export function registerEveryMockHandler(): void {
  registerAccessAndAuthMockHandlers();
  registerTeamAndSettingsMockHandlers();
  registerPosMockHandlers();
  registerCatalogMockHandlers();
  registerCommerceMockHandlers();
  registerInsightsMockHandlers();
  registerAffiliatesMockHandlers();
}
