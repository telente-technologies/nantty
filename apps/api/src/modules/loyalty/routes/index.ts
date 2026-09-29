import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerLoyaltyRoutes } from "./loyalty.routes.js";
// zudojs:route-imports:end

export function registerLoyaltyModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerLoyaltyRoutes(router, deps.loyaltyController, deps.web);
  // zudojs:routes:end
}
