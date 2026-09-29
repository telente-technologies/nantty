import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerVerificationsRoutes } from "./verifications.routes.js";
// zudojs:route-imports:end

export function registerVerificationsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerVerificationsRoutes(router, deps.verificationsController, deps.web);
  // zudojs:routes:end
}
