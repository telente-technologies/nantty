import type { HttpRouter } from "@zudojs/http";

import type { AppDependencies } from "../../../container.js";
// zudojs:route-imports:start
import { registerAutomationRoutes } from "./automation.routes.js";
// zudojs:route-imports:end

export function registerAutomationModuleRoutes(router: HttpRouter, deps: AppDependencies): void {
  // zudojs:routes:start
  registerAutomationRoutes(router, deps.automationController, deps.web);
  // zudojs:routes:end
}
