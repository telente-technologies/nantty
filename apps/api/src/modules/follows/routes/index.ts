import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerFollowsRoutes } from "./follows.routes.js";
// zudojs:route-imports:end

export function registerFollowsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerFollowsRoutes(router, deps.followsController, deps.web);
  // zudojs:routes:end
}
