import { registerConfigurationMockHandlers } from "@/mocks/handlers/configuration/configurationHandlers.mock";
import { registerContentAndSupportMockHandlers } from "@/mocks/handlers/content/contentHandlers.mock";
import { registerMoneyMockHandlers } from "@/mocks/handlers/money/moneyHandlers.mock";
import { registerPeopleMockHandlers } from "@/mocks/handlers/people/peopleHandlers.mock";
import { registerPlatformMockHandlers } from "@/mocks/handlers/platform/platformHandlers.mock";
import { registerTrustAndSafetyMockHandlers } from "@/mocks/handlers/trust/trustHandlers.mock";

export function registerEveryMockHandler(): void {
  registerPlatformMockHandlers();
  registerPeopleMockHandlers();
  registerTrustAndSafetyMockHandlers();
  registerMoneyMockHandlers();
  registerConfigurationMockHandlers();
  registerContentAndSupportMockHandlers();
}
