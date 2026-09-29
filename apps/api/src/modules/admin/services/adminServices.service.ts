import type { AdminSignInService } from "./adminSignIn.service.js";
import type { PlatformStaffService } from "./platformStaff.service.js";
import type { StaffAdministrationService } from "./staffAdministration.service.js";
import type { StaffSelfService } from "./staffSelfService.service.js";

export interface AdminServices {
  readonly staff: PlatformStaffService;
  readonly signIn: AdminSignInService;
  readonly administration: StaffAdministrationService;
  readonly selfService: StaffSelfService;
}
