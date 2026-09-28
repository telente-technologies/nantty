import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerCategoriesRoutes } from "./categories.routes.js";
// zudojs:route-imports:end

export function registerCategoriesModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerCategoriesRoutes(router, deps.categoriesController, deps.web);
  // zudojs:routes:end
}
