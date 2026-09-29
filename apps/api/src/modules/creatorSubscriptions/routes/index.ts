import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerCreatorSubscriptionsRoutes } from "./creatorSubscriptions.routes.js";
// zudojs:route-imports:end

export function registerCreatorSubscriptionsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerCreatorSubscriptionsRoutes(router, deps.creatorSubscriptionsController, deps.web);
  // zudojs:routes:end
}
