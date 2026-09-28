import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerAuthRoutes } from "./auth.routes.js";
// zudojs:route-imports:end

export function registerAuthModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerAuthRoutes(router, deps.authController, deps.web);
  // zudojs:routes:end
}
