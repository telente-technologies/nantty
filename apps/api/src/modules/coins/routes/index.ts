import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerCoinsRoutes } from "./coins.routes.js";
// zudojs:route-imports:end

export function registerCoinsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerCoinsRoutes(router, deps.coinsController, deps.web);
  // zudojs:routes:end
}
