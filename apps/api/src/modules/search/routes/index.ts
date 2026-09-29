import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerSearchRoutes } from "./search.routes.js";
// zudojs:route-imports:end

export function registerSearchModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerSearchRoutes(router, deps.searchController, deps.web);
  // zudojs:routes:end
}
