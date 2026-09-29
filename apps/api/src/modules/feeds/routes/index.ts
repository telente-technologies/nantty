import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerFeedsRoutes } from "./feeds.routes.js";
// zudojs:route-imports:end

export function registerFeedsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerFeedsRoutes(router, deps.feedsController, deps.web);
  // zudojs:routes:end
}
