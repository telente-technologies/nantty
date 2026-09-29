import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerPaymentsRoutes } from "./payments.routes.js";
// zudojs:route-imports:end

export function registerPaymentsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerPaymentsRoutes(router, deps.paymentsController, deps.web);
  // zudojs:routes:end
}
