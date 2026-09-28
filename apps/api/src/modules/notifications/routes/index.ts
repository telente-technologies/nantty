import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerNotificationsRoutes } from "./notifications.routes.js";
// zudojs:route-imports:end

export function registerNotificationsModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerNotificationsRoutes(router, deps.notificationsController, deps.web);
  // zudojs:routes:end
}
