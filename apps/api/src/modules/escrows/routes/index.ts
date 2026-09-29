import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerEscrowsRoutes } from "./escrows.routes.js";
// zudojs:route-imports:end

export function registerEscrowsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerEscrowsRoutes(router, deps.escrowsController, deps.web);
  // zudojs:routes:end
}
