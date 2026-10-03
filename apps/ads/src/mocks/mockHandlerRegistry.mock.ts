import { registerAccountMockHandlers } from "@/mocks/handlers/accounts.mock";
import { registerAdSetAndAdMockHandlers } from "@/mocks/handlers/adSetsAndAds.mock";
import { registerAudienceMockHandlers } from "@/mocks/handlers/audiences.mock";
import { registerAuthMockHandlers } from "@/mocks/handlers/auth.mock";
import { registerBillingMockHandlers } from "@/mocks/handlers/billing.mock";
import { registerCampaignMockHandlers } from "@/mocks/handlers/campaigns.mock";
import { registerConsentsMockHandlers } from "@/mocks/handlers/consents.mock";
import { registerMediaMockHandlers } from "@/mocks/handlers/media.mock";
import { registerMembersMockHandlers } from "@/mocks/handlers/members.mock";
import { registerReportMockHandlers } from "@/mocks/handlers/reports.mock";
import { registerToolMockHandlers } from "@/mocks/handlers/tools.mock";

export function registerEveryMockHandler(): void {
  registerAuthMockHandlers();
  registerConsentsMockHandlers();
  registerAccountMockHandlers();
  registerMembersMockHandlers();
  registerCampaignMockHandlers();
  registerAdSetAndAdMockHandlers();
  registerAudienceMockHandlers();
  registerMediaMockHandlers();
  registerBillingMockHandlers();
  registerReportMockHandlers();
  registerToolMockHandlers();
}
