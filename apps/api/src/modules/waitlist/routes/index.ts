import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerWaitlistRoutes } from "./waitlist.routes.js";
// zudojs:route-imports:end

export function registerWaitlistModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerWaitlistRoutes(router, deps.waitlistController, deps.web);
  // zudojs:routes:end
}
