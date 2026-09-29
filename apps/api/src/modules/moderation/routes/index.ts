import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerModerationRoutes } from "./moderation.routes.js";
// zudojs:route-imports:end

export function registerModerationModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerModerationRoutes(router, deps.moderationController, deps.web);
  // zudojs:routes:end
}
