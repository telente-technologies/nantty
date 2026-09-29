import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerAdminAuthRoutes, registerAdminStaffRoutes } from "./admin.routes.js";
// zudojs:route-imports:end

export function registerAdminModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerAdminAuthRoutes(router, deps.adminAuthController, deps.web);
  registerAdminStaffRoutes(router, deps.adminStaffController, deps.web);
  // zudojs:routes:end
}
