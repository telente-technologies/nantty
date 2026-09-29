import type { HttpMiddlewareContext, HttpResponseContext } from "@zudojs/http";

import type { Permission } from "../constants/permissions.constant.js";

export interface StaffRouteRequirement {
  readonly anyOfPermissions: readonly Permission[];
  readonly requireStepUp: boolean;
}

export interface PlatformStaffAccessCheck {
  handleStaffRequest(context: HttpMiddlewareContext, requirement: StaffRouteRequirement, next: () => Promise<HttpResponseContext>): Promise<HttpResponseContext>;
}
