import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerOrdersRoutes } from "./orders.routes.js";
// zudojs:route-imports:end

export function registerOrdersModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerOrdersRoutes(router, deps.ordersController, deps.sellerOrdersController, deps.web, deps.ports.requireSellerEntitlement("seller.dashboard"));
  // zudojs:routes:end
}
