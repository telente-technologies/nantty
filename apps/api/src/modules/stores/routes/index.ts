import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerSellerApplicationRoutes, registerStoresRoutes } from "./stores.routes.js";
// zudojs:route-imports:end

export function registerStoresModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerStoresRoutes(router, deps.storesController, deps.web);
  registerSellerApplicationRoutes(router, deps.sellerApplicationsController, deps.web);
  // zudojs:routes:end
}
