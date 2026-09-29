import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerWalletsRoutes } from "./wallets.routes.js";
// zudojs:route-imports:end

export function registerWalletsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerWalletsRoutes(router, deps.walletsController, deps.web);
  // zudojs:routes:end
}
