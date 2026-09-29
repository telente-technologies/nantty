import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerCurrencyRoutes } from "./currency.routes.js";
// zudojs:route-imports:end

export function registerCurrencyModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerCurrencyRoutes(router, deps.currencyController, deps.web);
  // zudojs:routes:end
}
