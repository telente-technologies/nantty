import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerMediaRoutes } from "./media.routes.js";
// zudojs:route-imports:end

export function registerMediaModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerMediaRoutes(router, deps.mediaController, deps.web);
  // zudojs:routes:end
}
