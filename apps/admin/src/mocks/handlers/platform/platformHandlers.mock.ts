import { registerAdminAccountMockHandlers } from "@/mocks/handlers/platform/adminAccounts.mock";
import { registerAdminAccountSelfMockHandlers } from "@/mocks/handlers/platform/adminAccountSelf.mock";
import { registerStaffManagementMockHandlers } from "@/mocks/handlers/platform/staffManagement.mock";
import { registerAuditLogMockHandlers } from "@/mocks/handlers/platform/auditLog.mock";
import { registerAuthenticationMockHandlers } from "@/mocks/handlers/platform/authentication.mock";
import { registerConsentsMockHandlers } from "@/mocks/handlers/platform/consents.mock";
import { registerPlatformMetricsMockHandlers } from "@/mocks/handlers/platform/platformMetrics.mock";
import { registerUserPreferencesMockHandlers } from "@/mocks/handlers/platform/userPreferences.mock";
import { registerEventOperationsMockHandlers } from "@/mocks/handlers/platform/eventOperations.mock";

export function registerPlatformMockHandlers(): void {
  registerAuthenticationMockHandlers();
  registerAdminAccountSelfMockHandlers();
  registerAdminAccountMockHandlers();
  registerStaffManagementMockHandlers();
  registerAuditLogMockHandlers();
  registerPlatformMetricsMockHandlers();
  registerConsentsMockHandlers();
  registerUserPreferencesMockHandlers();
  registerEventOperationsMockHandlers();
}
