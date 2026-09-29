import type { AdminSessionService } from "./adminSession.service.js";
import type { PlatformStaffService } from "./platformStaff.service.js";
import type { StaffAdministrationService } from "./staffAdministration.service.js";

export interface AdminModuleServices {
  readonly staff: PlatformStaffService;
  readonly sessions: AdminSessionService;
  readonly administration: StaffAdministrationService;
}
