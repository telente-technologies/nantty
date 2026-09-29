import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerCreatorAdminRoutes, registerCreatorsRoutes } from "./creators.routes.js";
import { registerCreatorMonetizationRoutes } from "./creatorMonetization.routes.js";
// zudojs:route-imports:end

export function registerCreatorsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerCreatorsRoutes(router, deps.creatorsController, deps.web);
  registerCreatorAdminRoutes(router, deps.creatorAdminController, deps.web);
  registerCreatorMonetizationRoutes(router, deps.creatorMonetizationController, deps.web);
  // zudojs:routes:end
}
