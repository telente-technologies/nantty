import { registerAdminAccountMockHandlers } from "@/mocks/handlers/platform/adminAccounts.mock";
import { registerAdminAccountSelfMockHandlers } from "@/mocks/handlers/platform/adminAccountSelf.mock";
import { registerAuditLogMockHandlers } from "@/mocks/handlers/platform/auditLog.mock";
import { registerAuthenticationMockHandlers } from "@/mocks/handlers/platform/authentication.mock";
import { registerConsentsMockHandlers } from "@/mocks/handlers/platform/consents.mock";
import { registerPlatformMetricsMockHandlers } from "@/mocks/handlers/platform/platformMetrics.mock";

export function registerPlatformMockHandlers(): void {
  registerAuthenticationMockHandlers();
  registerAdminAccountSelfMockHandlers();
  registerAdminAccountMockHandlers();
  registerAuditLogMockHandlers();
  registerPlatformMetricsMockHandlers();
  registerConsentsMockHandlers();
}
