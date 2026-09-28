import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerAuditRoutes } from "./audit.routes.js";
// zudojs:route-imports:end

export function registerAuditModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerAuditRoutes(router, deps.auditController, deps.web);
  // zudojs:routes:end
}
