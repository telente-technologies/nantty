import type { Permission } from "../constants/permissions.constant.js";
import type { Principal } from "./principal.interface.js";

export interface StaffRequestDetails {
  readonly clientIp: string | null;
  readonly method: string;
  readonly path: string;
}

export interface PlatformStaffAccessCheck {
  assertStaffMayUsePermission(principal: Principal, permission: Permission | undefined, request: StaffRequestDetails): Promise<void>;
  assertRecentStepUp(principal: Principal): Promise<void>;
  recordStaffAction(principal: Principal, request: StaffRequestDetails, outcome: { readonly permission: string; readonly status: number }): Promise<void>;
}

export interface PlatformPermissionGrants {
  findGrantedPlatformPermissions(userId: string): Promise<readonly Permission[]>;
}
