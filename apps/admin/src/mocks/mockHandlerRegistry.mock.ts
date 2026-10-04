import { registerBrandsMockHandlers } from "@/mocks/handlers/brands/brandsHandlers.mock";
import { registerConfigurationMockHandlers } from "@/mocks/handlers/configuration/configurationHandlers.mock";
import { registerRegionalPriceTableMockHandlers } from "@/mocks/handlers/configuration/regionalPriceTables.mock";
import { registerContentAndSupportMockHandlers } from "@/mocks/handlers/content/contentHandlers.mock";
import { registerLegalMockHandlers } from "@/mocks/handlers/legal/legalHandlers.mock";
import { registerMoneyMockHandlers } from "@/mocks/handlers/money/moneyHandlers.mock";
import { registerPeopleMockHandlers } from "@/mocks/handlers/people/peopleHandlers.mock";
import { registerPlatformMockHandlers } from "@/mocks/handlers/platform/platformHandlers.mock";
import { registerTrustAndSafetyMockHandlers } from "@/mocks/handlers/trust/trustHandlers.mock";

export function registerEveryMockHandler(): void {
  registerPlatformMockHandlers();
  registerPeopleMockHandlers();
  registerTrustAndSafetyMockHandlers();
  registerRegionalPriceTableMockHandlers();
  registerMoneyMockHandlers();
  registerConfigurationMockHandlers();
  registerContentAndSupportMockHandlers();
  registerBrandsMockHandlers();
  registerLegalMockHandlers();
}
