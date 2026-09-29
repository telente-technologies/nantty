import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerSupportRoutes } from "./support.routes.js";
// zudojs:route-imports:end

export function registerSupportModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerSupportRoutes(router, deps.supportController, deps.web);
  // zudojs:routes:end
}
