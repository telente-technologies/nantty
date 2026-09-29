import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerCartsRoutes } from "./carts.routes.js";
// zudojs:route-imports:end

export function registerCartsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerCartsRoutes(router, deps.cartsController, deps.web);
  // zudojs:routes:end
}
