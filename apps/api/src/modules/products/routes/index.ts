import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerProductsRoutes } from "./products.routes.js";
// zudojs:route-imports:end

export function registerProductsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerProductsRoutes(router, deps.productsController, deps.sellerProductsController, deps.web);
  // zudojs:routes:end
}
